import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://tv7.lk21official.cc';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1500; // 1.5 seconds between requests

// Axios instance with headers to avoid blocking
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': BASE_URL,
  },
  timeout: 15000,
});

// Delay helper
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Throttled request to avoid rate limiting
async function throttledRequest(url: string): Promise<string> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  
  lastRequestTime = Date.now();
  const { data } = await axiosInstance.get(url);
  return data;
}

// Interfaces
export interface FilmItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  year?: string;
  rating?: string;
  quality?: string;
  duration?: string;
  genres?: string[];
  country?: string;
  url: string;
}

export interface FilmDetail extends FilmItem {
  synopsis: string;
  director?: string;
  actors?: string[];
  country?: string;
  released?: string;
  translator?: string;
  servers: StreamServer[];
}

export interface StreamServer {
  name: string;
  url: string;
  quality?: string;
}

// Helper to get cached data
async function getCached<T>(key: string): Promise<T | null> {
  const redisCache = await redis.get(key);
  if (redisCache) {
    return JSON.parse(redisCache) as T;
  }
  
  const memCache = memoryCache.get(key);
  if (memCache && memCache.expiry > Date.now()) {
    return JSON.parse(memCache.data) as T;
  }
  
  if (memCache) {
    memoryCache.delete(key);
  }
  
  return null;
}

// Helper to set cache
async function setCache(key: string, data: unknown): Promise<void> {
  const jsonData = JSON.stringify(data);
  
  await redis.set(key, jsonData, CACHE_TTL);
  
  memoryCache.set(key, {
    data: jsonData,
    expiry: Date.now() + (CACHE_TTL * 1000),
  });
  
  // Clean old memory cache entries
  if (memoryCache.size > 100) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, 20);
    keysToDelete.forEach(k => memoryCache.delete(k));
  }
}

// Parse film card from homepage/listing
function parseFilmCard($: cheerio.CheerioAPI, el: any): FilmItem | null {
  const $el = $(el);
  const linkEl = $el.find('a').first();
  const href = linkEl.attr('href') || '';
  
  if (!href || !href.includes(BASE_URL)) return null;
  
  // Extract slug from URL (e.g., /lethal-sacrifice-2025)
  const slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
  if (!slug || slug.includes('/genre/') || slug.includes('/country/') || slug.includes('/artist/')) {
    return null;
  }
  
  // Title
  const title = $el.find('.grid-title, h2, h3').text().trim() ||
                $el.find('.item-title').text().trim() ||
                linkEl.attr('title') ||
                $el.find('img').attr('alt') || '';
  
  if (!title) return null;
  
  // Poster
  let poster = $el.find('img').attr('src') ||
               $el.find('img').attr('data-src') ||
               $el.find('img').attr('data-lazy-src') || '';
  
  // Rating (format: "6.5")
  const ratingText = $el.find('.rating, .score, .imdb').text().trim();
  const rating = ratingText.match(/[\d.]+/)?.[0] || '';
  
  // Year (format: "2025")
  const yearMatch = slug.match(/-(\d{4})$/);
  const year = yearMatch ? yearMatch[1] : '';
  
  // Quality (HD, BluRay, etc)
  const quality = $el.find('.quality, .qlty').text().trim() || 'HD';
  
  // Duration
  const duration = $el.find('.duration, .dur').text().trim() || '';
  
  // Genres
  const genres: string[] = [];
  $el.find('.genre a, .categories a').each((_, genreEl) => {
    genres.push($(genreEl).text().trim());
  });
  
  return {
    id: slug,
    title: title.substring(0, 150),
    slug,
    poster,
    year,
    rating,
    quality,
    duration,
    genres,
    url: href,
  };
}

/**
 * Get latest films from /release/page/N (1121+ pages available)
 */
export async function getLatestFilms(page: number = 1): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = `lk21:latest:${page}`;
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Use /release/page/N endpoint which has proper pagination
    const url = page === 1 ? `${BASE_URL}/release` : `${BASE_URL}/release/page/${page}`;
    console.log(`[LK21] Fetching page ${page}: ${url}`);
    
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const films: FilmItem[] = [];
    const seen = new Set<string>();
    const yearPattern = /-(\d{4})$/;

    // Scan links that contain images (movie cards have poster images)
    $('a').each((_, el) => {
      const $el = $(el);
      const $img = $el.find('img');
      
      // Movie links must have an image inside
      if ($img.length === 0) return;
      
      const href = $el.attr('href') || '';
      
      // Skip nav/filter links
      if (!href || 
          href.includes('/genre/') || href.includes('/country/') || 
          href.includes('/artist/') || href.includes('/series/') || 
          href.includes('/page/') || href.includes('/translator/') ||
          href.includes('/release/') || href.includes('/search/')) {
        return;
      }
      
      // Get title from anchor title OR img alt (LK21 uses img alt)
      const title = $el.attr('title') || $img.attr('alt') || '';
      if (!title || title.length < 3) return;
      
      let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      if (!slug || seen.has(slug) || slug.length < 3) return;
      if (slug.includes('/')) return; // Skip if has subdirectories
      
      const poster = $img.attr('src') || $img.attr('data-src') || '';
      const yearMatch = slug.match(yearPattern);
      
      seen.add(slug);
      films.push({
        id: slug,
        title: title.substring(0, 150),
        slug,
        poster,
        year: yearMatch ? yearMatch[1] : '',
        url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
      });
    });

    // Check for pagination - look for "dari X total halaman" text or next page links
    const paginationText = $('body').text();
    const totalPagesMatch = paginationText.match(/dari\s+(\d+)\s+total\s+halaman/i);
    const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 0;
    const hasNext = totalPages > page || page < 1000; // LK21 has 1000+ pages

    console.log(`[LK21] Page ${page}: Found ${films.length} films, totalPages: ${totalPages}, hasNext: ${hasNext}`);

    const result = { data: films.slice(0, 24), hasNext };
    
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching latest films:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get trending/popular films - collects from ALL homepage sections
 */
export async function getTrendingFilms(): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = 'lk21:trending';
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const html = await throttledRequest(BASE_URL);
    const $ = cheerio.load(html);

    const films: FilmItem[] = [];
    const seen = new Set<string>();
    
    // Year regex pattern
    const yearPattern = /-(\d{4})$/;

    // Scan for movie links using year-based selectors (proven to work)
    $('a[href*="-2023"], a[href*="-2024"], a[href*="-2025"], a[href*="-2022"], a[href*="-2021"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      // Skip non-movie links
      if (!href || href.includes('/genre/') || href.includes('/country/') || 
          href.includes('/artist/') || href.includes('/series/') || 
          href.includes('/page/') || href.includes('/translator/')) {
        return;
      }
      
      // Extract slug from URL
      let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      
      // Skip if already seen or invalid
      if (!slug || seen.has(slug) || slug.length < 3) return;
      // Skip if slug contains subdirectories
      if (slug.split('/').length > 1) return;
      
      const title = $el.attr('title') || $el.find('img').attr('alt') || '';
      const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      const yearMatch = slug.match(yearPattern);
      
      if (title && title.length > 2) {
        seen.add(slug);
        films.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          year: yearMatch ? yearMatch[1] : '',
          url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
        });
      }
    });

    console.log(`[LK21] Scraped ${films.length} films from homepage`);
    
    const result = { data: films.slice(0, 48), hasNext: true };
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    return result;
  } catch (error) {
    console.error('Error fetching trending films:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Search films using Puppeteer for JavaScript rendering
 */
export async function searchFilms(query: string, page: number = 1): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = `lk21:search:${query}:${page}`;
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  let browser = null;
  
  try {
    // Dynamic import of puppeteer
    const puppeteer = await import('puppeteer');
    
    const url = page > 1 
      ? `${BASE_URL}/search/page/${page}/?s=${encodeURIComponent(query)}`
      : `${BASE_URL}/search?s=${encodeURIComponent(query)}`;
    console.log(`[LK21] Searching with Puppeteer: ${url}`);
    
    // Launch headless browser
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const browserPage = await browser.newPage();
    await browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate and wait for search results to load
    await browserPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for results to render (LK21 uses JS to load results)
    await browserPage.waitForSelector('.gallery-grid a, #results a, .movie-list a', { timeout: 10000 }).catch(() => {});
    
    // Give extra time for rendering
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract film data from rendered page
    const films = await browserPage.evaluate((baseUrl: string) => {
      const results: any[] = [];
      const seen = new Set<string>();
      
      // Find all movie cards in results
      document.querySelectorAll('a').forEach((el) => {
        const img = el.querySelector('img');
        if (!img) return;
        
        const href = el.getAttribute('href') || '';
        if (!href || href.includes('/genre/') || href.includes('/country/') || 
            href.includes('/page/') || href.includes('/search/') || href.includes('/year/')) {
          return;
        }
        
        const title = el.getAttribute('title') || img.getAttribute('alt') || '';
        if (!title || title.length < 3) return;
        
        let slug = href.replace(baseUrl, '').replace(/^\//, '').replace(/\/$/, '');
        if (!slug || seen.has(slug) || slug.includes('/') || slug.length < 3) return;
        
        const poster = img.getAttribute('src') || img.getAttribute('data-src') || '';
        const yearMatch = slug.match(/-(\d{4})$/);
        
        seen.add(slug);
        results.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          year: yearMatch ? yearMatch[1] : '',
          url: href.startsWith('http') ? href : `${baseUrl}/${slug}`,
        });
      });
      
      return results;
    }, BASE_URL);
    
    await browser.close();
    browser = null;
    
    // Check for pagination
    const hasNext = films.length >= 20;
    
    console.log(`[LK21] Search "${query}" page ${page}: Found ${films.length} films via Puppeteer`);
    
    const result = { data: films, hasNext };
    
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error searching films with Puppeteer:', error);
    if (browser) {
      await browser.close();
    }
    return { data: [], hasNext: false };
  }
}

/**
 * Get film detail
 */
export async function getFilmDetail(slug: string): Promise<FilmDetail | null> {
  const cacheKey = `lk21:detail:${slug}`;
  const cached = await getCached<FilmDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/${slug}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    // Title
    const title = $('h1').first().text().trim() ||
                  $('title').text().split('|')[0].trim() ||
                  slug.replace(/-/g, ' ');

    // Poster
    const poster = $('meta[property="og:image"]').attr('content') ||
                   $('.poster img, .thumb img, .cover img').attr('src') ||
                   $('img[src*="poster"], img[src*="cover"]').first().attr('src') || '';

    // Synopsis
    let synopsis = '';
    $('.synopsis, .sinopsis, .description, .desc, [itemprop="description"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > synopsis.length) {
        synopsis = text;
      }
    });
    
    // Fallback synopsis from meta
    if (!synopsis) {
      synopsis = $('meta[name="description"]').attr('content') ||
                 $('meta[property="og:description"]').attr('content') || '';
    }

    // Extract info from links
    const genres: string[] = [];
    const actors: string[] = [];
    let director = '';
    let country = '';
    let translator = '';

    $('a[href*="/genre/"]').each((_, el) => {
      genres.push($(el).text().trim());
    });

    $('a[href*="/artist/"]').each((_, el) => {
      actors.push($(el).text().trim());
    });

    $('a[href*="/director/"]').each((_, el) => {
      director = $(el).text().trim();
    });

    $('a[href*="/country/"]').each((_, el) => {
      country = $(el).text().trim();
    });

    $('a[href*="/translator/"]').each((_, el) => {
      translator = $(el).text().trim();
    });

    // Rating
    const ratingText = $('.rating, .imdb, [itemprop="ratingValue"]').text();
    const rating = ratingText.match(/[\d.]+/)?.[0] || '';

    // Year
    const yearMatch = slug.match(/-(\d{4})$/);
    const year = yearMatch ? yearMatch[1] : '';

    // Duration
    const durationText = $('[itemprop="duration"], .duration, .runtime').text();
    const duration = durationText.match(/\d+:\d+|\d+\s*(?:min|menit)/i)?.[0] || '';

    // Streaming servers - find iframes
    const servers: StreamServer[] = [];
    
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('facebook') && !src.includes('twitter') && !src.includes('ads')) {
        servers.push({
          name: 'Player 1',
          url: src,
          quality: 'HD',
        });
      }
    });

    // Also look for player buttons
    $('[data-server], [data-url], .server-item, .player-option').each((idx, el) => {
      const $el = $(el);
      const serverUrl = $el.attr('data-server') || $el.attr('data-url') || $el.attr('href') || '';
      const serverName = $el.text().trim() || `Server ${idx + 1}`;
      
      if (serverUrl && serverUrl.startsWith('http') && !servers.some(s => s.url === serverUrl)) {
        servers.push({
          name: serverName,
          url: serverUrl,
          quality: serverName.includes('720') ? '720p' : serverName.includes('1080') ? '1080p' : 'HD',
        });
      }
    });

    const detail: FilmDetail = {
      id: slug,
      title: title.substring(0, 150),
      slug,
      poster,
      year,
      rating,
      duration,
      synopsis: synopsis || 'Tidak ada sinopsis.',
      genres: genres.slice(0, 5),
      director,
      actors: actors.slice(0, 10),
      country,
      translator,
      servers,
      url,
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching film detail:', error);
    return null;
  }
}

/**
 * Get films by genre
 */
export async function getFilmsByGenre(genre: string, page: number = 1): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = `lk21:genre:${genre}:${page}`;
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/genre/${genre}${page > 1 ? `/page/${page}` : ''}`;
    console.log(`[LK21] Fetching genre ${genre} page ${page}: ${url}`);
    
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const films: FilmItem[] = [];
    const seen = new Set<string>();
    const yearPattern = /-(\d{4})$/;

    // Scan links that contain images (movie cards have poster images)
    $('a').each((_, el) => {
      const $el = $(el);
      const $img = $el.find('img');
      
      // Movie links must have an image inside
      if ($img.length === 0) return;
      
      const href = $el.attr('href') || '';
      
      // Skip nav/filter links
      if (!href || 
          href.includes('/genre/') || href.includes('/country/') || 
          href.includes('/artist/') || href.includes('/series/') || 
          href.includes('/page/') || href.includes('/translator/') ||
          href.includes('/release/') || href.includes('/search/')) {
        return;
      }
      
      // Get title from anchor title OR img alt (LK21 uses img alt)
      const title = $el.attr('title') || $img.attr('alt') || '';
      if (!title || title.length < 3) return;
      
      let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      if (!slug || seen.has(slug) || slug.length < 3) return;
      if (slug.includes('/')) return;
      
      const poster = $img.attr('src') || $img.attr('data-src') || '';
      const yearMatch = slug.match(yearPattern);
      
      seen.add(slug);
      films.push({
        id: slug,
        title: title.substring(0, 150),
        slug,
        poster,
        year: yearMatch ? yearMatch[1] : '',
        genres: [genre],
        url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
      });
    });

    // Check for pagination
    const paginationText = $('body').text();
    const totalPagesMatch = paginationText.match(/dari\s+(\d+)\s+total\s+halaman/i);
    const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 0;
    const hasNext = totalPages > page || films.length >= 20;

    console.log(`[LK21] Genre ${genre} page ${page}: Found ${films.length} films, totalPages: ${totalPages}`);

    const result = { data: films.slice(0, 24), hasNext };
    
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching films by genre:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get films by country
 */
export async function getFilmsByCountry(country: string, page: number = 1): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = `lk21:country:${country}:${page}`;
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/country/${country}${page > 1 ? `/page/${page}` : ''}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const films: FilmItem[] = [];
    const seen = new Set<string>();

    $('a[href*="lk21official.cc"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      
      if (!slug || seen.has(slug) || slug.includes('/')) return;
      
      const title = $el.attr('title') || $el.find('img').attr('alt') || '';
      const poster = $el.find('img').attr('src') || '';
      const yearMatch = slug.match(/-(\d{4})$/);
      
      if (title && title.length > 2) {
        seen.add(slug);
        films.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          year: yearMatch ? yearMatch[1] : '',
          country,
          url: href,
        });
      }
    });

    const hasNext = $('.pagination .next, a.next').length > 0 || films.length >= 10;
    const result = { data: films.slice(0, 24), hasNext };
    
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching films by country:', error);
    return { data: [], hasNext: false };
  }
}

export default {
  getLatestFilms,
  getTrendingFilms,
  searchFilms,
  getFilmDetail,
  getFilmsByGenre,
  getFilmsByCountry,
};
