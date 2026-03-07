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

    // Detect redirect/blocking page from LK21
    // Only match the specific redirect phrase, NOT the brand name "nontondrama" (which appears on all pages)
    if (title.toLowerCase().includes('anda akan dialihkan') || 
        title.toLowerCase().includes('akan dialihkan ke')) {
      console.log(`[LK21] Detected redirect/blocking page for ${slug}, returning null`);
      return null;
    }

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

    // Streaming servers - extract from HTML using cheerio (no Puppeteer)
    const servers: StreamServer[] = [];
    
    // Pattern 1: Get main player iframe
    const mainPlayer = $('#main-player');
    if (mainPlayer.length > 0) {
      const src = mainPlayer.attr('src') || mainPlayer.attr('data-src') || '';
      if (src) {
        servers.push({ name: 'GANTI PLAYER', url: src, quality: 'HD' });
      }
    }
    
    // Pattern 2: Get all iframes that look like players
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('facebook') && !src.includes('twitter') && 
          !src.includes('ads') && !servers.some(s => s.url === src)) {
        servers.push({ name: 'Player', url: src, quality: 'HD' });
      }
    });
    
    // Pattern 3: Links with playeriframe.sbs
    $('a[href*="playeriframe.sbs"]').each((_, el) => {
      const name = $(el).text().trim() || 'Server';
      const href = $(el).attr('href') || '';
      if (href && !servers.some(s => s.url === href)) {
        servers.push({ name, url: href, quality: 'HD' });
      }
    });
    
    // Pattern 4: Elements with data-url, data-src, data-video
    $('[data-url], [data-src], [data-video]').each((_, el) => {
      const dataUrl = $(el).attr('data-url') || $(el).attr('data-src') || $(el).attr('data-video') || '';
      const name = $(el).text().trim() || 'Server';
      if (dataUrl && dataUrl.startsWith('http') && !servers.some(s => s.url === dataUrl)) {
        servers.push({ name, url: dataUrl, quality: 'HD' });
      }
    });
    
    // Pattern 5: Links with embed/player in URL
    $('a[href*="embed"], a[href*="player"]').each((_, el) => {
      const name = $(el).text().trim() || 'Server';
      const href = $(el).attr('href') || '';
      if (href && href.startsWith('http') && !servers.some(s => s.url === href)) {
        servers.push({ name, url: href, quality: 'HD' });
      }
    });
    
    console.log(`[LK21] Found ${servers.length} servers for ${slug}`);

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
    // Parse slug to extract base name and year
    // Input: "breaking-bad-2008" -> baseName: "breaking-bad", year: "2008"
    const yearMatch = slug.match(/-(\d{4})$/);
    const seriesYear = yearMatch ? yearMatch[1] : '';
    const baseName = seriesYear ? slug.replace(`-${seriesYear}`, '') : slug;
    
    console.log(`[LK21] Series detail (cheerio): baseName="${baseName}", year="${seriesYear}"`);
    
    // Episode URL format: base-name-season-X-episode-Y-year
    const firstEpisodeSlug = `${baseName}-season-1-episode-1${seriesYear ? '-' + seriesYear : ''}`;
    const firstEpisodeUrl = `${SERIES_URL}/${firstEpisodeSlug}`;
    console.log('[LK21] Fetching first episode:', firstEpisodeUrl);
    
    let html: string;
    try {
      html = await throttledRequest(firstEpisodeUrl);
    } catch (err) {
      console.error('[LK21] Failed to fetch first episode page:', err);
      return null;
    }
    
    const $ = cheerio.load(html);
    
    // Detect redirect/blocking page (only match specific redirect phrase, not the brand name)
    const pageTitle = $('h1').first().text().trim() || $('title').text().trim();
    if (pageTitle.toLowerCase().includes('anda akan dialihkan') || 
        pageTitle.toLowerCase().includes('akan dialihkan ke')) {
      console.log(`[LK21] Detected redirect/blocking page for series ${slug}`);
      return null;
    }
    
    // Extract title - remove Season/Episode suffix
    let title = pageTitle
      .replace(/\s*[-–]\s*Season.*$/i, '')
      .replace(/\s*Season.*$/i, '')
      .replace(/\s*Nonton\s*/i, '')
      .trim();
    if (!title || title.length < 2) {
      title = slug.replace(/-\d{4}$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    
    // Poster
    const poster = $('meta[property="og:image"]').attr('content') ||
                   $('.poster img, .thumb img, .cover img').attr('src') || '';
    
    // Find total seasons from "Season X dari Y" text
    let totalSeasons = 0;
    const bodyText = $('body').text().toLowerCase();
    const seasonDariMatch = bodyText.match(/season\s*\d+\s*dari\s*(\d+)/i);
    if (seasonDariMatch) {
      totalSeasons = parseInt(seasonDariMatch[1]);
    }
    
    // Fallback: Look for season links/buttons to determine total seasons
    if (totalSeasons === 0) {
      const seasonNumbers: number[] = [];
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const seasonMatch = href.match(/season-(\d+)-episode/);
        if (seasonMatch) {
          seasonNumbers.push(parseInt(seasonMatch[1]));
        }
      });
      if (seasonNumbers.length > 0) {
        totalSeasons = Math.max(...seasonNumbers);
      }
    }
    
    // If still no seasons found, assume 1 season
    if (totalSeasons === 0) {
      totalSeasons = 1;
    }
    
    console.log(`[LK21] Found series "${title}" with ${totalSeasons} seasons`);
    
    // Initialize seasons
    const seasons: Season[] = [];
    const episodes: Episode[] = [];
    
    for (let i = 1; i <= totalSeasons; i++) {
      seasons.push({ number: i, episodeCount: 0 });
    }
    
    // For each season, visit episode 1 page and extract episode links/buttons
    for (let seasonNum = 1; seasonNum <= totalSeasons; seasonNum++) {
      const seasonEpSlug = `${baseName}-season-${seasonNum}-episode-1${seriesYear ? '-' + seriesYear : ''}`;
      const seasonEpUrl = `${SERIES_URL}/${seasonEpSlug}`;
      console.log(`[LK21] Scraping season ${seasonNum}: ${seasonEpUrl}`);
      
      try {
        // Reuse the first page HTML if this is season 1
        let seasonHtml: string;
        if (seasonNum === 1) {
          seasonHtml = html;
        } else {
          seasonHtml = await throttledRequest(seasonEpUrl);
        }
        
        const $s = cheerio.load(seasonHtml);
        const seenNums = new Set<number>();
        
        // Look for episode links/buttons (small numbered links)
        $s('a').each((_, el) => {
          const text = $s(el).text().trim();
          const href = $s(el).attr('href') || '';
          
          // Check if text is just a small number (episode number)
          if (/^[1-9]\d?$/.test(text)) {
            const epNum = parseInt(text);
            
            // Verify this looks like an episode link
            const isEpisodeLink = href.includes(`-season-${seasonNum}-episode-`);
            const isSimpleNumber = epNum >= 1 && epNum <= 50;
            
            if ((isEpisodeLink || isSimpleNumber) && !seenNums.has(epNum)) {
              seenNums.add(epNum);
              const epSlug = `${baseName}-season-${seasonNum}-episode-${epNum}${seriesYear ? '-' + seriesYear : ''}`;
              episodes.push({
                season: seasonNum,
                episode: epNum,
                title: `Episode ${epNum}`,
                slug: epSlug,
                url: `${SERIES_URL}/${epSlug}`,
              });
            }
          }
        });
        
        // Fallback: Look for links containing "episode-N" pattern
        if (seenNums.size === 0) {
          $s(`a[href*="season-${seasonNum}-episode-"]`).each((_, el) => {
            const href = $s(el).attr('href') || '';
            const epMatch = href.match(/episode-(\d+)/);
            if (epMatch) {
              const epNum = parseInt(epMatch[1]);
              if (!seenNums.has(epNum)) {
                seenNums.add(epNum);
                const epSlug = `${baseName}-season-${seasonNum}-episode-${epNum}${seriesYear ? '-' + seriesYear : ''}`;
                episodes.push({
                  season: seasonNum,
                  episode: epNum,
                  title: `Episode ${epNum}`,
                  slug: epSlug,
                  url: `${SERIES_URL}/${epSlug}`,
                });
              }
            }
          });
        }
        
        // Update season episode count
        const maxEp = seenNums.size > 0 ? Math.max(...seenNums) : 0;
        seasons[seasonNum - 1].episodeCount = maxEp;
        
        console.log(`[LK21] Season ${seasonNum}: ${seenNums.size} episodes (max: ${maxEp})`);
      } catch (err) {
        console.error(`[LK21] Error scraping season ${seasonNum}:`, err);
        // If season page fails, it might not exist - that's OK
      }
    }
    
    // Sort episodes
    episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    
    const detail: SeriesDetail = {
      id: slug,
      title: title.substring(0, 150),
      slug,
      poster,
      year: seriesYear,
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
    
    if (episodes.length > 0) {
      await setCache(cacheKey, detail);
    }
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
    const url = `${SERIES_URL}/${episodeSlug}`;
    console.log('[LK21] Fetching episode (cheerio):', url);
    
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);
    
    // Detect redirect/blocking page (only match specific redirect phrase, not the brand name)
    const pageTitle = $('h1').first().text().trim() || $('title').text().trim();
    if (pageTitle.toLowerCase().includes('anda akan dialihkan') || 
        pageTitle.toLowerCase().includes('akan dialihkan ke')) {
      console.log(`[LK21] Detected redirect/blocking page for episode ${episodeSlug}`);
      return [];
    }
    
    const serverData: Array<{name: string, url: string}> = [];
    
    // Pattern 1: Get main player iframe
    const mainPlayer = $('#main-player');
    if (mainPlayer.length > 0) {
      const src = mainPlayer.attr('src') || mainPlayer.attr('data-src') || '';
      if (src) {
        serverData.push({ name: 'GANTI PLAYER', url: src });
      }
    }
    
    // Pattern 2: Get all iframes (player/embed)
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('facebook') && !src.includes('twitter') && 
          !src.includes('ads') && !serverData.some(s => s.url === src)) {
        serverData.push({ name: 'PLAYER', url: src });
      }
    });
    
    // Pattern 3: Links with playeriframe.sbs
    $('a[href*="playeriframe.sbs"]').each((_, el) => {
      const name = $(el).text().trim() || 'Server';
      const href = $(el).attr('href') || '';
      if (href && !serverData.some(s => s.url === href)) {
        serverData.push({ name, url: href });
      }
    });
    
    // Pattern 4: Elements with data-url, data-src, data-video attributes
    $('[data-url], [data-src], [data-video]').each((_, el) => {
      const dataUrl = $(el).attr('data-url') || $(el).attr('data-src') || $(el).attr('data-video') || '';
      const name = $(el).text().trim() || 'Server';
      if (dataUrl && dataUrl.startsWith('http') && !serverData.some(s => s.url === dataUrl)) {
        serverData.push({ name, url: dataUrl });
      }
    });
    
    // Pattern 5: Links with known server names
    const serverNames = ['P2P', 'TURBOVIP', 'CAST', 'HYDRAX', 'HD', 'SERVER', 'PLAYER'];
    $('a[href]').each((_, el) => {
      const name = ($(el).text().trim() || '').toUpperCase();
      const href = $(el).attr('href') || '';
      
      const isServer = serverNames.some(sn => name.includes(sn));
      const isPlayerUrl = href.includes('player') || href.includes('embed') || href.includes('stream');
      
      if ((isServer || isPlayerUrl) && href && href.startsWith('http') && 
          !serverData.some(s => s.url === href) && !href.includes('/episode-')) {
        serverData.push({ name: $(el).text().trim() || 'Server', url: href });
      }
    });
    
    // Filter to keep only valid servers
    const validServerNames = ['GANTI PLAYER', 'TURBOVIP', 'CAST', 'HYDRAX', 'P2P', 'PLAYER'];
    const filteredServers = serverData.filter(s => {
      const name = (s.name || '').toUpperCase().trim();
      return validServerNames.some(valid => name.includes(valid));
    });
    
    // Use filtered if available, otherwise use all found
    const finalServers = filteredServers.length > 0 ? filteredServers : serverData;
    
    const servers: StreamServer[] = finalServers.map((s, idx) => ({
      name: s.name || `Server ${idx + 1}`,
      url: s.url,
      quality: 'HD',
    }));

    console.log(`[LK21] Found ${servers.length} servers for episode ${episodeSlug}`);
    
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
