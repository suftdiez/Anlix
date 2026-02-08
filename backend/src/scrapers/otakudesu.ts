import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import redis from '../config/redis';

const BASE_URL = 'https://otakudesu.best';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between requests

// Axios instance with headers to avoid blocking
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  },
  timeout: 20000,
  maxRedirects: 5,
});

// Delay helper to avoid rate limiting
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Throttled request to avoid 429 errors
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

export interface AnimeItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  status?: string;
  rating?: string;
  latestEpisode?: string;
  genres?: string[];
  url: string;
  source: 'otakudesu';
}

export interface AnimeDetail extends AnimeItem {
  synopsis: string;
  score?: string;
  duration?: string;
  studio?: string;
  season?: string;
  released?: string;
  totalEpisodes?: string;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  number: string;
  title: string;
  slug: string;
  url: string;
  date?: string;
}

export interface EpisodeDetail {
  title: string;
  animeTitle: string;
  episodeNumber: string;
  servers: StreamServer[];
  prevEpisode?: string;
  nextEpisode?: string;
}

export interface StreamServer {
  name: string;
  url: string;
  quality?: string;
}

// Helper to get cached data (Redis with in-memory fallback)
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

// Helper to set cache (both Redis and in-memory)
async function setCache(key: string, data: unknown): Promise<void> {
  const jsonData = JSON.stringify(data);
  
  await redis.set(key, jsonData, CACHE_TTL);
  
  memoryCache.set(key, {
    data: jsonData,
    expiry: Date.now() + (CACHE_TTL * 1000),
  });
  
  if (memoryCache.size > 100) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, 20);
    keysToDelete.forEach(k => memoryCache.delete(k));
  }
}

/**
 * Get latest/ongoing anime from homepage
 */
export async function getLatestAnime(page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `otakudesu:latest:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    // Otakudesu uses .venz for ongoing anime section
    $('.venz ul li, .veildl ul li, .rseries ul li, .rapi ul li').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.jdlflm').text().trim() ||
                  $el.find('.thumb h2').text().trim() ||
                  $el.find('h2').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      
      const episode = $el.find('.epz').text().trim() ||
                      $el.find('.newnime').text().trim();
      const day = $el.find('.epztipe').text().trim() ||
                  $el.find('.damark').text().trim();

      if (href && title) {
        const match = href.match(/\/anime\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          status: 'Ongoing',
          latestEpisode: episode,
          url: `${BASE_URL}/anime/${slug}/`,
          source: 'otakudesu',
        });
      }
    });

    const hasNext = $('.pagination .next, .hpage .r, a.next, .nextpostslink').length > 0 ||
                    $('a:contains("Next")').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching latest anime from otakudesu:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get completed anime
 */
export async function getCompleteAnime(page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `otakudesu:complete:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 ? `${BASE_URL}/complete-anime/` : `${BASE_URL}/complete-anime/page/${page}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    // Complete anime section
    $('.venz ul li, .veildl ul li, .rseries ul li, .rapi ul li, .col-anime-con').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.jdlflm').text().trim() ||
                  $el.find('.thumb h2').text().trim() ||
                  $el.find('h2').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      
      const rating = $el.find('.score').text().trim();

      if (href && title) {
        const match = href.match(/\/anime\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          status: 'Completed',
          rating: rating,
          url: `${BASE_URL}/anime/${slug}/`,
          source: 'otakudesu',
        });
      }
    });

    const hasNext = $('.pagination .next, .hpage .r, a.next, .nextpostslink').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching complete anime from otakudesu:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Search anime by query
 */
export async function searchAnime(query: string, page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `otakudesu:search:${query}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=anime`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    // Search results
    $('.veildl ul li, .chi_childs ul li, .page ul li').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.jdlflm').text().trim() ||
                  $el.find('h2').text().trim() ||
                  linkEl.attr('title') || 
                  linkEl.text().trim();
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      
      const genres = $el.find('.set').text().trim();

      if (href && title && href.includes('/anime/')) {
        const match = href.match(/\/anime\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          genres: genres ? [genres] : [],
          url: `${BASE_URL}/anime/${slug}/`,
          source: 'otakudesu',
        });
      }
    });

    const hasNext = $('.pagination .next, .hpage .r').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error searching anime on otakudesu:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get anime detail by slug
 */
export async function getAnimeDetail(slug: string): Promise<AnimeDetail | null> {
  const cacheKey = `otakudesu:detail:${slug}`;
  const cached = await getCached<AnimeDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/anime/${slug}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const title = $('.jdlrx h1, .infozin h1, .entry-title').first().text().trim();
    const poster = $('.fotoanime img, .thumbook img').attr('src') || '';
    const synopsis = $('.sinopc p, .desc p, .sinopsis p').first().text().trim() ||
                     $('.sinopc, .sinopsis').text().trim();

    // Extract info
    const info: Record<string, string> = {};
    $('.infozin .infozingle p, .spe span').each((_, el) => {
      const text = $(el).text();
      const parts = text.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const value = parts.slice(1).join(':').trim();
        info[key] = value;
      }
    });

    // Extract genres
    const genres: string[] = [];
    $('.infozin .infozingle p:contains("Genre") a, .genre-info a, .genxed a').each((_, el) => {
      genres.push($(el).text().trim());
    });

    // Extract episodes (filter out batch/download entries)
    const episodes: Episode[] = [];
    $('.episodelist ul li, .eplister ul li').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      const episodeTitle = linkEl.text().trim() || $el.find('.leftoff').text().trim();
      
      // Skip batch/download entries
      const lowerTitle = episodeTitle.toLowerCase();
      if (lowerTitle.includes('batch') || lowerTitle.includes('download') || lowerTitle.includes('lengkap')) {
        return;
      }
      
      // Only include episode links (not batch links)
      if (!href.includes('/episode/')) {
        return;
      }
      
      const episodeNum = episodeTitle.match(/Episode\s*(\d+)/i)?.[1] || 
                         episodeTitle.match(/(\d+)/)?.[1] || '';
      const date = $el.find('.rightoff, .zebin time').text().trim();

      if (href) {
        const epMatch = href.match(/\/episode\/([^/]+)/);
        const epSlug = epMatch ? epMatch[1] : href.split('/').filter(Boolean).pop() || '';
        
        episodes.push({
          id: epSlug,
          number: episodeNum,
          title: episodeTitle,
          slug: epSlug,
          url: href,
          date: date,
        });
      }
    });

    const detail: AnimeDetail = {
      id: slug,
      title: title || slug,
      slug: slug,
      poster: poster,
      synopsis: synopsis || 'Tidak ada sinopsis.',
      type: info['type'] || info['tipe'] || 'TV',
      status: info['status'] || '',
      score: info['score'] || info['skor'] || info['rating'] || '',
      duration: info['duration'] || info['durasi'] || '',
      studio: info['studio'] || info['produser'] || '',
      season: info['season'] || info['musim'] || '',
      released: info['released'] || info['rilis'] || info['tanggal rilis'] || '',
      totalEpisodes: info['total episode'] || info['episode'] || '',
      genres: genres,
      episodes: episodes.reverse(),
      url: url,
      source: 'otakudesu',
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching anime detail from otakudesu:', error);
    return null;
  }
}

/**
 * Get episode streaming data using Puppeteer
 */
export async function getEpisodeDetail(slug: string): Promise<EpisodeDetail | null> {
  const cacheKey = `otakudesu:episode:${slug}`;
  const cached = await getCached<EpisodeDetail>(cacheKey);
  if (cached) return cached;

  let browser = null;
  
  try {
    const url = `${BASE_URL}/episode/${slug}/`;
    
    // Launch Puppeteer headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to episode page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for mirror stream elements to load
    await page.waitForSelector('.mirrorstream, iframe', { timeout: 10000 }).catch(() => {});
    
    // Extract basic info
    const title = await page.$eval('.entry-title, .posttl, h1.entry-title', el => el.textContent?.trim() || '').catch(() => '');
    const animeTitle = title.split('Episode')[0].trim();
    const episodeNumber = title.match(/Episode\s*(\d+)/i)?.[1] || '';
    
    const servers: StreamServer[] = [];
    
    // Get default iframe first
    const defaultIframe = await page.$eval('iframe', el => el.src || el.getAttribute('data-src') || '').catch(() => '');
    if (defaultIframe && !defaultIframe.includes('facebook') && !defaultIframe.includes('twitter') && !defaultIframe.includes('ads')) {
      servers.push({
        name: 'Default Player',
        url: defaultIframe.startsWith('//') ? `https:${defaultIframe}` : defaultIframe,
        quality: 'HD',
      });
    }
    
    // Get button count and info via page.evaluate (avoiding element handle issues)
    const buttonCount = await page.evaluate(() => document.querySelectorAll('[data-content]').length);
    console.log(`Found ${buttonCount} server buttons`);
    
    // Click each button using DOM manipulation and capture iframe changes
    for (let i = 0; i < buttonCount; i++) {
      try {
        // Get button info and click it via evaluate (in browser context)
        const serverInfo = await page.evaluate((index) => {
          const buttons = document.querySelectorAll('[data-content]');
          const btn = buttons[index] as HTMLElement | null;
          if (!btn) return null;
          
          const text = btn.textContent?.trim() || 'Server';
          const parent = btn.closest('.mirrorstream') || btn.closest('div');
          const h4 = parent?.querySelector('h4');
          const qualityMatch = h4?.textContent?.match(/(\d+p)/i);
          const quality = qualityMatch ? qualityMatch[1] : 'HD';
          
          // Click the button
          btn.click();
          
          return { name: text, quality };
        }, i);
        
        if (!serverInfo) continue;
        
        // Wait for iframe to update via AJAX
        await delay(1000);
        
        // Get the new iframe src
        const newIframe = await page.$eval('iframe', el => el.src || '').catch(() => '');
        
        if (newIframe && !newIframe.includes('facebook') && !newIframe.includes('twitter') && !newIframe.includes('ads')) {
          const cleanUrl = newIframe.startsWith('//') ? `https:${newIframe}` : newIframe;
          
          // Only add if not duplicate
          if (!servers.some(s => s.url === cleanUrl)) {
            servers.push({
              name: `${serverInfo.name} (${serverInfo.quality})`,
              url: cleanUrl,
              quality: serverInfo.quality,
            });
          }
        }
      } catch (e) {
        // Ignore individual button errors
      }
    }
    
    // Get prev/next episode
    const prevEpisode = await page.$eval('.flir .lmark a, .prevnext .prev a', el => {
      const href = el.getAttribute('href') || '';
      return href.split('/').filter(Boolean).pop() || '';
    }).catch(() => '');
    
    const nextEpisode = await page.$eval('.flir .rmark a, .prevnext .next a', el => {
      const href = el.getAttribute('href') || '';
      return href.split('/').filter(Boolean).pop() || '';
    }).catch(() => '');
    
    await browser.close();
    browser = null;
    
    const detail: EpisodeDetail = {
      title: title,
      animeTitle: animeTitle,
      episodeNumber: episodeNumber,
      servers: servers,
      prevEpisode: prevEpisode || undefined,
      nextEpisode: nextEpisode || undefined,
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching episode detail from otakudesu:', error);
    if (browser) {
      await browser.close();
    }
    return null;
  }
}

/**
 * Get anime by genre
 */
export async function getAnimeByGenre(genre: string, page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `otakudesu:genre:${genre}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 
      ? `${BASE_URL}/genres/${genre}/`
      : `${BASE_URL}/genres/${genre}/page/${page}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    $('.col-anime-con, .venz ul li, .veildl ul li').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.col-anime-title, .jdlflm, h2').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';

      if (href && title && href.includes('/anime/')) {
        const match = href.match(/\/anime\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          url: `${BASE_URL}/anime/${slug}/`,
          source: 'otakudesu',
        });
      }
    });

    const hasNext = $('.pagination .next, .hpage .r').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching anime by genre from otakudesu:', error);
    return { data: [], hasNext: false };
  }
}

export default {
  getLatestAnime,
  getCompleteAnime,
  searchAnime,
  getAnimeDetail,
  getEpisodeDetail,
  getAnimeByGenre,
};
