/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://tv8.lk21official.cc';
const SERIES_URL = 'https://tv3.nontondrama.my';
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
  relatedFilms?: FilmItem[];
  trailerUrl?: string;
}

export interface StreamServer {
  name: string;
  url: string;
  quality?: string;
}

// Series interfaces
export interface Season {
  number: number;
  episodeCount: number;
}

export interface Episode {
  season: number;
  episode: number;
  title: string;
  slug: string;
  url: string;
}

export interface SeriesDetail extends FilmDetail {
  isSeries: boolean;
  seasons: Season[];
  episodes: Episode[];
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

    // Streaming servers - use Puppeteer to get dynamically loaded server tabs
    const servers: StreamServer[] = [];
    
    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      
      const browserPage = await browser.newPage();
      await browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await browserPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for player to load (LK21 shows "Tunggu" message while loading)
      await new Promise(r => setTimeout(r, 5000));
      
      // Extract server tabs from the page
      const serverData = await browserPage.evaluate(() => {
        const result: Array<{name: string, url: string}> = [];
        
        // Get main player iframe first
        const mainPlayer = document.getElementById('main-player') as HTMLIFrameElement;
        if (mainPlayer && mainPlayer.src) {
          result.push({
            name: 'GANTI PLAYER',
            url: mainPlayer.src,
          });
        }
        
        // Get all server tab links (P2P, TURBOVIP, CAST, HYDRAX)
        document.querySelectorAll('a[href*="playeriframe.sbs"]').forEach((el) => {
          const link = el as HTMLAnchorElement;
          const name = link.textContent?.trim() || 'Server';
          const href = link.href;
          
          // Avoid duplicates
          if (href && !result.some(s => s.url === href)) {
            result.push({ name, url: href });
          }
        });
        
        // Also try other possible iframe embed sources
        document.querySelectorAll('a[href*="embed"], a[href*="player"]').forEach((el) => {
          const link = el as HTMLAnchorElement;
          const name = link.textContent?.trim() || 'Server';
          const href = link.href;
          
          if (href && href.startsWith('http') && !result.some(s => s.url === href)) {
            result.push({ name, url: href });
          }
        });
        
        return result;
      });
      
      await browser.close();
      
      // Convert to StreamServer format
      serverData.forEach((s, idx) => {
        servers.push({
          name: s.name || `Server ${idx + 1}`,
          url: s.url,
          quality: 'HD',
        });
      });
      
      console.log(`[LK21] Found ${servers.length} servers for ${slug}`);
    } catch (puppeteerError) {
      console.error('[LK21] Puppeteer server extraction failed:', puppeteerError);
      
      // Fallback to Cheerio-based extraction
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
    }

    // Extract related films ("Movie Terkait" section)
    const relatedFilms: FilmItem[] = [];
    const seenRelated = new Set<string>();
    const yearPattern = /-(\d{4})$/;
    
    // Look for related movies section - scan all anchors with images after the player section
    $('a').each((_, el) => {
      const $el = $(el);
      const $img = $el.find('img');
      
      if ($img.length === 0) return;
      if (relatedFilms.length >= 12) return; // Limit to 12 related films
      
      const href = $el.attr('href') || '';
      
      // Skip navigation/filter links
      if (!href || 
          href.includes('/genre/') || href.includes('/country/') || 
          href.includes('/artist/') || href.includes('/series/') || 
          href.includes('/page/') || href.includes('/translator/') ||
          href.includes('/release/') || href.includes('/search/') ||
          href.includes('/year/') || href.includes('/rating') ||
          href.includes('/director/')) {
        return;
      }
      
      // Skip current film
      if (href.includes(slug)) return;
      
      const relTitle = $el.attr('title') || $img.attr('alt') || '';
      if (!relTitle || relTitle.length < 3) return;
      
      let relSlug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      if (!relSlug || seenRelated.has(relSlug) || relSlug.length < 3) return;
      if (relSlug.includes('/')) return;
      
      const relPoster = $img.attr('src') || $img.attr('data-src') || '';
      const relYearMatch = relSlug.match(yearPattern);
      
      seenRelated.add(relSlug);
      relatedFilms.push({
        id: relSlug,
        title: relTitle.substring(0, 150),
        slug: relSlug,
        poster: relPoster,
        year: relYearMatch ? relYearMatch[1] : '',
        url: href.startsWith('http') ? href : `${BASE_URL}/${relSlug}`,
      });
    });
    
    console.log(`[LK21] Found ${relatedFilms.length} related films for ${slug}`);

    // Extract trailer from YouTube iframe (mostly for series on nontondrama.my)
    let trailerUrl: string | undefined;
    const trailerIframe = $('div.trailer-series iframe[src*="youtube"], iframe[src*="youtube.com/embed"]').first();
    if (trailerIframe.length > 0) {
      const iframeSrc = trailerIframe.attr('src') || '';
      const videoIdMatch = iframeSrc.match(/embed\/([a-zA-Z0-9_-]+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        trailerUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
        console.log(`[LK21] Found trailer: ${trailerUrl}`);
      }
    }

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
      relatedFilms,
      trailerUrl,
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
    console.log(`[LK21] Fetching country ${country} page ${page}: ${url}`);
    
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
          href.includes('/release/') || href.includes('/search/') ||
          href.includes('/year/') || href.includes('/rating')) {
        return;
      }
      
      // Get title from anchor title OR img alt
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
        country,
        url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
      });
    });

    // Check for pagination
    const paginationText = $('body').text();
    const totalPagesMatch = paginationText.match(/dari\s+(\d+)\s+total\s+halaman/i);
    const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 0;
    const hasNext = totalPages > page || films.length >= 20;

    console.log(`[LK21] Country ${country} page ${page}: Found ${films.length} films, totalPages: ${totalPages}`);

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

/**
 * Get featured/unggulan series from homepage
 * Scrapes series that have EPS badges from the main LK21 homepage
 */
export async function getFeaturedSeries(page: number = 1): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = `lk21:featured-series:${page}`;
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Scrape from homepage where "SERIES UNGGULAN" section is
    console.log(`[LK21] Fetching featured series from homepage`);
    
    const html = await throttledRequest(BASE_URL);
    const $ = cheerio.load(html);

    const series: FilmItem[] = [];
    const seen = new Set<string>();
    const yearPattern = /-(\d{4})$/;

    // Look for links with images that have EPS badges (series indicators)
    // Series on LK21 have badges like "EPS 10" or "EPS 16" with season info
    $('a').each((_, el) => {
      const $el = $(el);
      const $parent = $el.parent();
      const $container = $parent.parent();
      
      // Check if this item has an EPS badge (series indicator)
      const containerText = $container.text().toUpperCase();
      const parentText = $parent.text().toUpperCase();
      const hasEpsBadge = containerText.includes('EPS') || parentText.includes('EPS') || 
                          containerText.includes('S.') || parentText.includes('S.');
      
      if (!hasEpsBadge) return;
      
      const $img = $el.find('img');
      if ($img.length === 0) return;
      
      const href = $el.attr('href') || '';
      
      // Skip navigation/filter links
      if (!href || 
          href.includes('/genre/') || href.includes('/country/') || 
          href.includes('/page/') || href.includes('/search/') ||
          href.includes('/artist/') || href.includes('/translator/')) {
        return;
      }
      
      // Get title from anchor title OR img alt
      const title = $el.attr('title') || $img.attr('alt') || '';
      if (!title || title.length < 3) return;
      
      // Extract slug
      let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
      if (!slug || seen.has(slug) || slug.length < 3) return;
      if (slug.includes('/')) return;
      
      const poster = $img.attr('src') || $img.attr('data-src') || '';
      const yearMatch = slug.match(yearPattern);
      
      // Extract episode info from container text 
      const epsMatch = containerText.match(/EPS\s*(\d+)/i) || parentText.match(/EPS\s*(\d+)/i);
      const seasonMatch = containerText.match(/S\.?\s*(\d+)/i) || parentText.match(/S\.?\s*(\d+)/i);
      
      let quality = 'Series';
      if (epsMatch) {
        quality = `EPS ${epsMatch[1]}`;
        if (seasonMatch) {
          quality = `S${seasonMatch[1]} ${quality}`;
        }
      }
      
      seen.add(slug);
      series.push({
        id: slug,
        title: title.substring(0, 150),
        slug,
        poster,
        year: yearMatch ? yearMatch[1] : '',
        quality,
        url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
      });
    });

    console.log(`[LK21] Featured series: Found ${series.length} series from homepage`);

    // Only return first page of results (no real pagination for homepage scraping)
    const hasNext = false;
    const result = { data: series.slice(0, 24), hasNext };
    
    if (series.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching featured series:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get series updates - recently updated series from homepage
 * Scrapes from the "SERIES UPDATE" section on LK21 homepage
 */
export async function getSeriesUpdate(): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = 'lk21:series-update';
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    console.log(`[LK21] Fetching series update from homepage`);
    
    const html = await throttledRequest(BASE_URL);
    const $ = cheerio.load(html);

    const series: FilmItem[] = [];
    const seen = new Set<string>();
    const yearPattern = /-(\d{4})$/;

    // Find the "SERIES UPDATE" section by looking for the heading
    let inSeriesUpdate = false;
    let seriesUpdateSection: any = null;

    // Search for section headers that contain "SERIES UPDATE"
    $('h2, h3, .section-title, [class*="title"]').each((_, el) => {
      const text = $(el).text().toUpperCase();
      if (text.includes('SERIES UPDATE') || text.includes('UPDATE SERIES')) {
        // Found the section, get its parent container
        seriesUpdateSection = $(el).closest('section, .section, .row, .container, div').first();
        if (seriesUpdateSection.length === 0) {
          seriesUpdateSection = $(el).parent().parent();
        }
        inSeriesUpdate = true;
        return false; // break
      }
    });

    // If we found the section, extract series from it
    if (seriesUpdateSection) {
      seriesUpdateSection.find('a').each((_i: number, el: any) => {
        const $el = $(el);
        const $img = $el.find('img');
        
        if ($img.length === 0) return;
        if (series.length >= 24) return;
        
        const href = $el.attr('href') || '';
        
        // Skip navigation links
        if (!href || 
            href.includes('/genre/') || href.includes('/country/') || 
            href.includes('/page/') || href.includes('/search/')) {
          return;
        }
        
        const title = $el.attr('title') || $img.attr('alt') || '';
        if (!title || title.length < 3) return;
        
        let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
        if (!slug || seen.has(slug) || slug.length < 3) return;
        if (slug.includes('/')) return;
        
        const poster = $img.attr('src') || $img.attr('data-src') || '';
        const yearMatch = slug.match(yearPattern);
        
        // Get episode info if available
        const $parent = $el.parent();
        const parentText = $parent.text().toUpperCase();
        const epsMatch = parentText.match(/EPS\s*(\d+)/i);
        
        let quality = 'Update';
        if (epsMatch) {
          quality = `EPS ${epsMatch[1]}`;
        }
        
        seen.add(slug);
        series.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          year: yearMatch ? yearMatch[1] : '',
          quality,
          url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
        });
      });
    }

    // Fallback: If section not found, look for items with "update" indicators
    if (series.length === 0) {
      console.log('[LK21] Series update section not found, using fallback');
      // Look for recently aired series (items with recent dates or "Baru" badge)
      $('a').each((_, el) => {
        const $el = $(el);
        const $parent = $el.parent();
        const $container = $parent.parent();
        
        const containerText = $container.text().toUpperCase();
        const parentText = $parent.text().toUpperCase();
        
        // Look for indicators of recent updates
        const hasUpdateIndicator = containerText.includes('EPS') && 
          (containerText.includes('BARU') || containerText.includes('NEW') || 
           containerText.includes('UPDATE') || containerText.includes('2026') ||
           containerText.includes('2025'));
        
        if (!hasUpdateIndicator) return;
        
        const $img = $el.find('img');
        if ($img.length === 0) return;
        if (series.length >= 12) return;
        
        const href = $el.attr('href') || '';
        if (!href || href.includes('/genre/') || href.includes('/page/')) return;
        
        const title = $el.attr('title') || $img.attr('alt') || '';
        if (!title || title.length < 3) return;
        
        let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
        if (!slug || seen.has(slug) || slug.includes('/')) return;
        
        const poster = $img.attr('src') || $img.attr('data-src') || '';
        const yearMatch = slug.match(yearPattern);
        const epsMatch = containerText.match(/EPS\s*(\d+)/i);
        
        seen.add(slug);
        series.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          year: yearMatch ? yearMatch[1] : '',
          quality: epsMatch ? `EPS ${epsMatch[1]}` : 'Update',
          url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
        });
      });
    }

    console.log(`[LK21] Series update: Found ${series.length} series`);

    const result = { data: series.slice(0, 24), hasNext: false };
    
    if (series.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching series update:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get popular/trending films from homepage
 * Scrapes films from the "TERPOPULER" or trending section on LK21 homepage
 */
export async function getPopularFilms(): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = 'lk21:popular-films';
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    console.log(`[LK21] Fetching popular films from homepage`);
    
    const html = await throttledRequest(BASE_URL);
    const $ = cheerio.load(html);

    const films: FilmItem[] = [];
    const seen = new Set<string>();
    const yearPattern = /-(\d{4})$/;

    // Find the "TERPOPULER", "POPULAR", "TRENDING" section
    let popularSection: any = null;

    $('h2, h3, .section-title, [class*="title"]').each((_, el) => {
      const text = $(el).text().toUpperCase();
      if (text.includes('TERPOPULER') || text.includes('POPULAR') || 
          text.includes('TRENDING') || text.includes('TOP FILM')) {
        popularSection = $(el).closest('section, .section, .row, .container, div').first();
        if (popularSection.length === 0) {
          popularSection = $(el).parent().parent();
        }
        return false; // break
      }
    });

    // If we found the section, extract films from it
    if (popularSection) {
      popularSection.find('a').each((_: any, el: any) => {
        const $el = $(el);
        const $img = $el.find('img');
        
        if ($img.length === 0) return;
        if (films.length >= 24) return;
        
        const href = $el.attr('href') || '';
        
        // Skip navigation links and series (those with EPS badge)
        if (!href || 
            href.includes('/genre/') || href.includes('/country/') || 
            href.includes('/page/') || href.includes('/search/')) {
          return;
        }
        
        // Skip series items
        const parentText = $el.parent().text().toUpperCase();
        if (parentText.includes('EPS') || parentText.includes('S.')) {
          return;
        }
        
        const title = $el.attr('title') || $img.attr('alt') || '';
        if (!title || title.length < 3) return;
        
        let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
        if (!slug || seen.has(slug) || slug.length < 3) return;
        if (slug.includes('/')) return;
        
        const poster = $img.attr('src') || $img.attr('data-src') || '';
        const yearMatch = slug.match(yearPattern);
        
        // Get quality badge
        const qualityText = $el.find('.quality, .qlty').text().trim() || 
                           $el.parent().find('.quality, .qlty').text().trim() || 'HD';
        
        seen.add(slug);
        films.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          year: yearMatch ? yearMatch[1] : '',
          quality: qualityText,
          url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
        });
      });
    }

    // Fallback: Look for films with high ratings or quality indicators
    if (films.length === 0) {
      console.log('[LK21] Popular section not found, using fallback');
      $('a').each((_, el) => {
        const $el = $(el);
        const $parent = $el.parent();
        const $container = $parent.parent();
        
        const containerText = $container.text().toUpperCase();
        const parentText = $parent.text().toUpperCase();
        
        // Skip series (items with EPS)
        if (containerText.includes('EPS') || parentText.includes('EPS')) return;
        
        // Look for quality indicators (HD, BluRay, etc.)
        const hasQuality = containerText.includes('HD') || containerText.includes('BLURAY') ||
                          containerText.includes('CAM') || containerText.includes('WEB-DL');
        
        if (!hasQuality) return;
        
        const $img = $el.find('img');
        if ($img.length === 0) return;
        if (films.length >= 12) return;
        
        const href = $el.attr('href') || '';
        if (!href || href.includes('/genre/') || href.includes('/page/')) return;
        
        const title = $el.attr('title') || $img.attr('alt') || '';
        if (!title || title.length < 3) return;
        
        let slug = href.replace(BASE_URL, '').replace(/^\//, '').replace(/\/$/, '');
        if (!slug || seen.has(slug) || slug.includes('/')) return;
        
        const poster = $img.attr('src') || $img.attr('data-src') || '';
        const yearMatch = slug.match(yearPattern);
        
        seen.add(slug);
        films.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          year: yearMatch ? yearMatch[1] : '',
          quality: 'HD',
          url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
        });
      });
    }

    console.log(`[LK21] Popular films: Found ${films.length} films`);

    const result = { data: films.slice(0, 24), hasNext: false };
    
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching popular films:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get series detail with seasons and episodes
 * Strategy: Visit episode 1 of season 1, extract "Season X dari Y" to get total seasons,
 * then for each season, visit episode 1 and extract episode buttons (small numbered buttons)
 */
export async function getSeriesDetail(slug: string): Promise<SeriesDetail | null> {
  const cacheKey = `lk21:series:${slug}`;
  const cached = await getCached<SeriesDetail>(cacheKey);
  if (cached) return cached;

  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const browserPage = await browser.newPage();
    await browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Parse slug to extract base name and year
    // Input: "breaking-bad-2008" -> baseName: "breaking-bad", year: "2008"
    const yearMatch = slug.match(/-(\d{4})$/);
    const seriesYear = yearMatch ? yearMatch[1] : '';
    const baseName = seriesYear ? slug.replace(`-${seriesYear}`, '') : slug;
    
    console.log(`[LK21] Parsed slug: baseName="${baseName}", year="${seriesYear}"`);
    
    // Episode URL format: base-name-season-X-episode-Y-year
    // e.g., "breaking-bad-season-1-episode-1-2008"
    const firstEpisodeUrl = `${SERIES_URL}/${baseName}-season-1-episode-1${seriesYear ? '-' + seriesYear : ''}`;
    console.log('[LK21] Fetching first episode:', firstEpisodeUrl);
    
    await browserPage.goto(firstEpisodeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Extract basic info and total seasons
    const basicInfo = await browserPage.evaluate(() => {
      const data = {
        title: '',
        poster: '',
        year: '',
        totalSeasons: 0,
        isSeries: false,
      };

      // Get title - remove Season/Episode suffix
      const h1 = document.querySelector('h1');
      let title = h1?.textContent?.trim() || document.title.split('|')[0].trim();
      title = title.replace(/\s*[-–]\s*Season.*$/i, '').replace(/\s*Season.*$/i, '').trim();
      data.title = title;

      // Get poster
      const posterMeta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
      data.poster = posterMeta?.content || '';

      // Get year from URL
      const yearMatch = window.location.href.match(/-(\d{4})(?:[/-]|$)/);
      data.year = yearMatch ? yearMatch[1] : '';

      // Find "Season X dari Y" text to get total seasons
      const bodyText = document.body.innerText;
      const seasonDariMatch = bodyText.match(/Season\s*\d+\s*dari\s*(\d+)/i);
      if (seasonDariMatch) {
        data.totalSeasons = parseInt(seasonDariMatch[1]);
        data.isSeries = true;
      }

      // Also check h1/h2 text for season info
      const headings = document.querySelectorAll('h1, h2, h3');
      headings.forEach(h => {
        const text = h.textContent || '';
        if (text.toLowerCase().includes('season') && text.toLowerCase().includes('episode')) {
          data.isSeries = true;
        }
      });

      return data;
    });

    if (!basicInfo.isSeries || basicInfo.totalSeasons === 0) {
      console.log(`[LK21] ${slug} is not detected as series or no seasons found`);
      await browser.close();
      return null;
    }

    console.log(`[LK21] Found series with ${basicInfo.totalSeasons} seasons`);

    // Initialize seasons
    const seasons: Season[] = [];
    const episodes: Episode[] = [];
    
    for (let i = 1; i <= basicInfo.totalSeasons; i++) {
      seasons.push({ number: i, episodeCount: 0 });
    }

    // For each season, visit episode 1 and extract episode buttons
    for (let seasonNum = 1; seasonNum <= basicInfo.totalSeasons; seasonNum++) {
      // Use baseName with year at end: base-name-season-X-episode-1-year
      const seasonEpUrl = `${SERIES_URL}/${baseName}-season-${seasonNum}-episode-1${seriesYear ? '-' + seriesYear : ''}`;
      console.log(`[LK21] Scraping season ${seasonNum}: ${seasonEpUrl}`);

      try {
        await browserPage.goto(seasonEpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        // Extract episode buttons - look for small boxes with just numbers
        const seasonEps = await browserPage.evaluate((sNum: number, bName: string, yr: string) => {
          const eps: Array<{episode: number, slug: string}> = [];
          const seenNums = new Set<number>();

          // Find all links/buttons with just a number (1-99) as text
          // Episode buttons are typically small numbered boxes
          document.querySelectorAll('a').forEach(link => {
            const text = (link.textContent || '').trim();
            const href = link.href || '';
            
            // Check if text is just a small number (episode number)
            if (/^[1-9]\d?$/.test(text)) {
              const epNum = parseInt(text);
              
              // Verify this looks like an episode link (should contain season-X-episode-Y pattern)
              // or be a simple numbered button in the episode area
              const isEpisodeLink = href.includes(`-season-${sNum}-episode-`);
              const isSimpleNumber = epNum >= 1 && epNum <= 50;
              
              if ((isEpisodeLink || isSimpleNumber) && !seenNums.has(epNum)) {
                seenNums.add(epNum);
                // Construct proper slug: base-name-season-X-episode-Y-year
                const epSlug = `${bName}-season-${sNum}-episode-${epNum}${yr ? '-' + yr : ''}`;
                eps.push({ episode: epNum, slug: epSlug });
              }
            }
          });

          // Sort by episode number
          eps.sort((a, b) => a.episode - b.episode);
          return eps;
        }, seasonNum, baseName, seriesYear);

        // Add episodes for this season
        seasonEps.forEach(ep => {
          episodes.push({
            season: seasonNum,
            episode: ep.episode,
            title: `Episode ${ep.episode}`,
            slug: ep.slug,
            url: `${SERIES_URL}/${ep.slug}`,
          });
        });

        // Update season episode count
        const maxEp = seasonEps.length > 0 ? Math.max(...seasonEps.map(e => e.episode)) : 0;
        seasons[seasonNum - 1].episodeCount = maxEp;

        console.log(`[LK21] Season ${seasonNum}: ${seasonEps.length} episodes (max: ${maxEp})`);
      } catch (err) {
        console.error(`[LK21] Error scraping season ${seasonNum}:`, err);
        // If season page fails, it might not exist - that's OK
      }
    }

    await browser.close();

    // Sort episodes
    episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);

    const detail: SeriesDetail = {
      id: slug,
      title: basicInfo.title.substring(0, 150),
      slug,
      poster: basicInfo.poster,
      year: basicInfo.year,
      rating: '',
      synopsis: 'Tidak ada sinopsis.',
      genres: [],
      servers: [],
      url: `${SERIES_URL}/${slug}`,
      isSeries: true,
      seasons,
      episodes,
    };

    console.log(`[LK21] Final: ${seasons.length} seasons, ${episodes.length} episodes`);
    
    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('[LK21] Error fetching series detail:', error);
    return null;
  }
}

/**
 * Get streaming servers for a specific episode
 */
export async function getEpisodeStreaming(episodeSlug: string): Promise<StreamServer[]> {
  const cacheKey = `lk21:episode:${episodeSlug}`;
  const cached = await getCached<StreamServer[]>(cacheKey);
  if (cached) return cached;

  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const browserPage = await browser.newPage();
    await browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // LK21 series/episodes use nontondrama.my domain
    const SERIES_URL = 'https://tv3.nontondrama.my';
    const url = `${SERIES_URL}/${episodeSlug}`;
    
    console.log('[LK21] Fetching episode from:', url);
    
    await browserPage.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for player to load
    await new Promise(r => setTimeout(r, 7000));

    // Extract server tabs (same logic as film)
    const serverData = await browserPage.evaluate(() => {
      const result: Array<{name: string, url: string}> = [];
      
      // Get main player iframe first
      const mainPlayer = document.getElementById('main-player') as HTMLIFrameElement;
      if (mainPlayer && mainPlayer.src) {
        result.push({
          name: 'GANTI PLAYER',
          url: mainPlayer.src,
        });
      }
      
      // Also try to get iframe without ID
      if (result.length === 0) {
        const iframes = document.querySelectorAll('iframe[src*="player"], iframe[src*="embed"]');
        iframes.forEach(iframe => {
          const src = (iframe as HTMLIFrameElement).src;
          if (src && !result.some(s => s.url === src)) {
            result.push({ name: 'PLAYER', url: src });
          }
        });
      }
      
      // Get all server tab links - multiple selector patterns
      // Pattern 1: Links with playeriframe.sbs
      document.querySelectorAll('a[href*="playeriframe.sbs"]').forEach((el) => {
        const link = el as HTMLAnchorElement;
        const name = link.textContent?.trim() || 'Server';
        const href = link.href;
        
        if (href && !result.some(s => s.url === href)) {
          result.push({ name, url: href });
        }
      });
      
      // Pattern 2: Server tab buttons with data attributes
      document.querySelectorAll('[data-url], [data-src], [data-video]').forEach(el => {
        const url = el.getAttribute('data-url') || el.getAttribute('data-src') || el.getAttribute('data-video') || '';
        const name = el.textContent?.trim() || 'Server';
        if (url && !result.some(s => s.url === url)) {
          result.push({ name, url });
        }
      });
      
      // Pattern 3: Look for common server names in link text
      const serverNames = ['P2P', 'TURBOVIP', 'CAST', 'HYDRAX', 'HD', 'SERVER', 'PLAYER'];
      document.querySelectorAll('a[href]').forEach(el => {
        const link = el as HTMLAnchorElement;
        const name = link.textContent?.trim().toUpperCase() || '';
        const href = link.href;
        
        // Check if the text matches known server names
        const isServer = serverNames.some(sn => name.includes(sn));
        const isPlayerUrl = href.includes('player') || href.includes('embed') || href.includes('stream');
        
        if ((isServer || isPlayerUrl) && href && !result.some(s => s.url === href) && !href.includes('/episode-')) {
          result.push({ name: link.textContent?.trim() || 'Server', url: href });
        }
      });
      
      // Pattern 4: Look in the player area for tabs
      const playerArea = document.querySelector('.player-area, .player-tabs, .tabs, .server-list');
      if (playerArea) {
        playerArea.querySelectorAll('a[href]').forEach(el => {
          const link = el as HTMLAnchorElement;
          const name = link.textContent?.trim() || 'Server';
          const href = link.href;
          if (href && !result.some(s => s.url === href) && !href.includes('/episode-')) {
            result.push({ name, url: href });
          }
        });
      }
      
      return result;
    });

    await browser.close();

    // Only keep the 4 valid servers: GANTI PLAYER, TURBOVIP, CAST, HYDRAX
    const validServerNames = ['GANTI PLAYER', 'TURBOVIP', 'CAST', 'HYDRAX', 'P2P'];
    const filteredServers = serverData.filter(s => {
      const name = (s.name || '').toUpperCase().trim();
      return validServerNames.some(valid => name.includes(valid));
    });

    const servers: StreamServer[] = filteredServers.map((s, idx) => ({
      name: s.name || `Server ${idx + 1}`,
      url: s.url,
      quality: 'HD',
    }));

    console.log(`[LK21] Found ${servers.length} valid servers (filtered from ${serverData.length})`);
    
    if (servers.length > 0) {
      await setCache(cacheKey, servers);
    }
    
    return servers;
  } catch (error) {
    console.error('[LK21] Error fetching episode streaming:', error);
    return [];
  }
}

/**
 * Get films by year
 */
export async function getFilmsByYear(year: number, page: number = 1): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = `lk21:year:${year}:${page}`;
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/year/${year}${page > 1 ? `/page/${page}` : ''}`;
    console.log(`[LK21] Fetching year ${year} page ${page}: ${url}`);
    
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
          href.includes('/release/') || href.includes('/search/') ||
          href.includes('/year/')) {
        return;
      }
      
      // Get title from anchor title OR img alt
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
        year: yearMatch ? yearMatch[1] : String(year),
        url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
      });
    });

    // Check for pagination - look for "dari X total halaman" text
    const paginationText = $('body').text();
    const totalPagesMatch = paginationText.match(/dari\s+(\d+)\s+total\s+halaman/i);
    const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 0;
    const hasNext = totalPages > page || films.length >= 20;

    console.log(`[LK21] Year ${year} page ${page}: Found ${films.length} films, totalPages: ${totalPages}`);

    const result = { data: films.slice(0, 24), hasNext };
    
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching films by year:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get top rated films
 */
export async function getTopRatedFilms(page: number = 1): Promise<{ data: FilmItem[]; hasNext: boolean }> {
  const cacheKey = `lk21:toprated:${page}`;
  const cached = await getCached<{ data: FilmItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/rating${page > 1 ? `/page/${page}` : ''}`;
    console.log(`[LK21] Fetching top rated page ${page}: ${url}`);
    
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
          href.includes('/release/') || href.includes('/search/') ||
          href.includes('/year/') || href.includes('/rating')) {
        return;
      }
      
      // Get title from anchor title OR img alt
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
        url: href.startsWith('http') ? href : `${BASE_URL}/${slug}`,
      });
    });

    // Check for pagination
    const paginationText = $('body').text();
    const totalPagesMatch = paginationText.match(/dari\s+(\d+)\s+total\s+halaman/i);
    const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 0;
    const hasNext = totalPages > page || films.length >= 20;

    console.log(`[LK21] Top rated page ${page}: Found ${films.length} films, totalPages: ${totalPages}`);

    const result = { data: films.slice(0, 24), hasNext };
    
    if (films.length > 0) {
      await setCache(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching top rated films:', error);
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
  getFilmsByYear,
  getTopRatedFilms,
  getSeriesDetail,
  getEpisodeStreaming,
};
