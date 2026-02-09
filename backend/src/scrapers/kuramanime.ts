import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import redis from '../config/redis';

const BASE_URL = 'https://v13.kuramanime.tel';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

// Axios instance with headers
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  },
  timeout: 20000,
  maxRedirects: 5,
});

// Delay helper
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Throttled request
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
  source: 'kuramanime';
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
    expiry: Date.now() + CACHE_TTL * 1000,
  });
}

// Parse anime card from listing pages
function parseAnimeCard($: cheerio.CheerioAPI, el: any): AnimeItem | null {
  const $el = $(el);
  const link = $el.find('a').first();
  const href = link.attr('href') || '';
  
  // Extract ID from URL: /anime/{id}/{slug}
  const match = href.match(/\/anime\/(\d+)\/([^\/]+)/);
  if (!match) return null;
  
  const id = match[1];
  const slug = match[2];
  
  const title = $el.find('.product__item__text h5, .anime__item__text h5, h5').first().text().trim() ||
                $el.find('a').attr('title')?.trim() || slug.replace(/-/g, ' ');
  
  // Try multiple poster sources - kuramanime often uses data-setbg or style background
  let poster = $el.find('img').attr('src') || 
               $el.find('img').attr('data-src') || 
               $el.find('[data-setbg]').attr('data-setbg') ||
               $el.find('.set-bg').attr('data-setbg') ||
               $el.find('.product__item__pic').attr('data-setbg') ||
               '';
  
  // Also check style attribute for background-image
  if (!poster) {
    const styleAttr = $el.find('.product__item__pic, .set-bg, [style*="background"]').attr('style') || '';
    const bgMatch = styleAttr.match(/background-image:\s*url\(['"]?([^'")\s]+)/i);
    if (bgMatch) poster = bgMatch[1];
  }
  
  const status = $el.find('.ep-status, .status').first().text().trim();
  const type = $el.find('.type, .badge').first().text().trim();
  const latestEpisode = $el.find('.ep, .episode').first().text().trim();
  
  return {
    id,
    title,
    slug,
    poster: poster ? (poster.startsWith('//') ? `https:${poster}` : poster) : '',
    type,
    status,
    latestEpisode,
    url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
    source: 'kuramanime',
  };
}

// Get latest/ongoing anime
export async function getLatestAnime(page = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `kuramanime:latest:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/quick/ongoing?order_by=latest&page=${page}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    
    // Parse anime cards - try multiple selectors
    $('.product__item, .anime__item, .anime-card, [class*="anime"]').each((_, el) => {
      const anime = parseAnimeCard($, el);
      if (anime) animeList.push(anime);
    });

    // Check for next page
    const hasNext = $('.pagination .next, .page-item:last-child a').length > 0 &&
                   !$('.pagination .next, .page-item:last-child').hasClass('disabled');

    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching latest from kuramanime:', error);
    return { data: [], hasNext: false };
  }
}

// Get completed anime
export async function getCompleteAnime(page = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `kuramanime:complete:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/quick/finished?order_by=latest&page=${page}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    
    $('.product__item, .anime__item, .anime-card, [class*="anime"]').each((_, el) => {
      const anime = parseAnimeCard($, el);
      if (anime) animeList.push(anime);
    });

    const hasNext = $('.pagination .next, .page-item:last-child a').length > 0 &&
                   !$('.pagination .next, .page-item:last-child').hasClass('disabled');

    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching completed from kuramanime:', error);
    return { data: [], hasNext: false };
  }
}

// Search anime
export async function searchAnime(query: string, page = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `kuramanime:search:${query}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/anime?search=${encodeURIComponent(query)}&order_by=popular&page=${page}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    
    $('.product__item, .anime__item, .anime-card, [class*="anime"]').each((_, el) => {
      const anime = parseAnimeCard($, el);
      if (anime) animeList.push(anime);
    });

    const hasNext = $('.pagination .next, .page-item:last-child a').length > 0 &&
                   !$('.pagination .next, .page-item:last-child').hasClass('disabled');

    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error searching kuramanime:', error);
    return { data: [], hasNext: false };
  }
}

// Get anime detail using Puppeteer for dynamic content
// id can be in format "numericId" or "numericId/slug"
export async function getAnimeDetail(id: string): Promise<AnimeDetail | null> {
  const cacheKey = `kuramanime:detail:${id}`;
  const cached = await getCached<AnimeDetail>(cacheKey);
  if (cached) return cached;

  let browser;
  try {
    // Construct URL - if id contains slash, use as-is; otherwise try to find slug
    let url: string;
    if (id.includes('/')) {
      // Format: id/slug already provided
      url = `${BASE_URL}/anime/${id}`;
    } else {
      // Just numeric id - navigate to anime list page to get slug or try common patterns
      url = `${BASE_URL}/anime/${id}`;
    }
    
    // Use Puppeteer because kuramanime loads content dynamically
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Click the "DAFTAR EPISODE" button to reveal episode list (kuramanime hides it by default)
    try {
      await page.click('#episodeLists');
      await delay(1000); // Wait for episode list to appear
    } catch {
      // Button might not exist on all pages, continue without clicking
    }

    // Extract all data in browser context
    const data = await page.evaluate(() => {
      // Title - try multiple selectors
      let title = document.querySelector('h1')?.textContent?.trim() || '';
      if (!title) {
        // Try alternative selectors common on anime sites
        title = document.querySelector('.anime__details__title h3, .anime__details__text h3')?.textContent?.trim() || '';
      }
      if (!title) {
        title = document.querySelector('.anime__details__title h1, .anime__details__text h1')?.textContent?.trim() || '';
      }
      if (!title) {
        // Try any heading in the details section
        title = document.querySelector('[class*="anime__details"] h3, [class*="anime__details"] h2')?.textContent?.trim() || '';
      }
      if (!title) {
        // Get page title as last resort
        const pageTitle = document.title;
        title = pageTitle.replace(/- Kuramanime.*$/i, '').trim();
      }
      
      // Poster - try multiple sources
      let poster = '';
      const posterImg = document.querySelector('.anime__details__pic img, .poster img, img.poster') as HTMLImageElement;
      if (posterImg) {
        poster = posterImg.src || posterImg.dataset?.src || '';
      }
      // Also try background-image style
      const picDiv = document.querySelector('.anime__details__pic, [class*="poster"]') as HTMLElement;
      if (picDiv && !poster) {
        const style = picDiv.getAttribute('style') || '';
        const match = style.match(/background-image:\s*url\(['"]?([^'")\s]+)/i);
        if (match) poster = match[1];
        // Also check data-setbg
        poster = poster || picDiv.getAttribute('data-setbg') || '';
      }
      // Try any large image
      if (!poster) {
        document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
          if (!poster && img.src && img.width > 150 && !img.src.includes('icon') && !img.src.includes('logo')) {
            poster = img.src;
          }
        });
      }
      
      // Synopsis
      const synopsis = document.querySelector('.anime__details__text p, .synopsis, .synop, .description')?.textContent?.trim() || '';
      
      // Info items
      const infoItems: Record<string, string> = {};
      document.querySelectorAll('.anime__details__widget li, .anime-info li').forEach((li: Element) => {
        const text = li.textContent || '';
        const parts = text.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim().toLowerCase();
          const value = parts.slice(1).join(':').trim();
          infoItems[key] = value;
        }
      });
      
      // Genres
      const genres: string[] = [];
      document.querySelectorAll('.genre a, a[href*="genre"]').forEach((a: Element) => {
        const text = a.textContent?.trim();
        if (text) genres.push(text);
      });
      
      // Episodes - extract from episode-specific links with URL pattern /episode/N
      const episodes: Array<{number: string; title: string; href: string}> = [];
      const seenNumbers = new Set<string>();
      
      document.querySelectorAll('a[href*="/episode/"]').forEach((a: Element) => {
        const href = (a as HTMLAnchorElement).href || '';
        // Extract episode number from URL path like /episode/1 or /episode/12
        const epUrlMatch = href.match(/\/episode\/(\d+)/);
        if (epUrlMatch && epUrlMatch[1]) {
          const epNum = epUrlMatch[1];
          // Avoid duplicates
          if (!seenNumbers.has(epNum)) {
            seenNumbers.add(epNum);
            episodes.push({
              number: epNum,
              title: `Episode ${epNum}`,
              href: href,
            });
          }
        }
      });
      
      return { title, poster, synopsis, infoItems, genres, episodes };
    });

    await browser.close();

    // Debug logging
    console.log('Kuramanime detail extraction result:', {
      title: data.title,
      poster: data.poster ? data.poster.substring(0, 50) + '...' : 'NONE',
      synopsisLength: data.synopsis?.length || 0,
      episodesCount: data.episodes?.length || 0,
    });

    if (!data.title) return null;

    // Sort episodes by number before mapping
    const sortedEpisodes = data.episodes.sort((a, b) => parseInt(a.number) - parseInt(b.number));
    
    const episodes: Episode[] = sortedEpisodes.map(ep => ({
      id: `${id}-${ep.number}`,
      number: ep.number,
      title: ep.title,
      slug: ep.href.split('/').pop() || '',
      url: ep.href,
    }));

    const detail: AnimeDetail = {
      id,
      title: data.title,
      slug: id,
      poster: data.poster ? (data.poster.startsWith('//') ? `https:${data.poster}` : data.poster) : '',
      synopsis: data.synopsis,
      type: data.infoItems['type'] || data.infoItems['tipe'],
      status: data.infoItems['status'],
      rating: data.infoItems['rating'] || data.infoItems['skor'],
      score: data.infoItems['score'] || data.infoItems['skor'],
      duration: data.infoItems['duration'] || data.infoItems['durasi'],
      studio: data.infoItems['studio'],
      season: data.infoItems['season'] || data.infoItems['musim'],
      released: data.infoItems['released'] || data.infoItems['rilis'],
      totalEpisodes: data.infoItems['episodes'] || data.infoItems['episode'],
      genres: data.genres,
      episodes,
      url: url,
      source: 'kuramanime',
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching anime detail from kuramanime:', error);
    if (browser) await browser.close();
    return null;
  }
}

// Get episode detail with streaming servers using Puppeteer
export async function getEpisodeDetail(animeId: string, episodeNum: string): Promise<EpisodeDetail | null> {
  const cacheKey = `kuramanime:episode:${animeId}:${episodeNum}`;
  const cached = await getCached<EpisodeDetail>(cacheKey);
  if (cached) return cached;

  try {
    // First try to find the episode URL
    const animeDetail = await getAnimeDetail(animeId);
    if (!animeDetail) return null;

    const episode = animeDetail.episodes.find(ep => ep.number === episodeNum);
    const url = episode?.url || `${BASE_URL}/anime/${animeId}/episode/${episodeNum}`;

    // Use Puppeteer to extract streaming servers
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Extract streaming info
    const title = await page.$eval('h1, .episode-title', el => el.textContent?.trim() || '').catch(() => '');
    
    const servers: StreamServer[] = [];
    
    // Get main iframe - but skip chat iframes
    const mainIframe = await page.$eval('iframe', el => el.src).catch(() => '');
    // Skip chat widgets, ads, and social embeds - these are not video players
    const isValidVideoIframe = mainIframe && 
      !mainIframe.includes('facebook') && 
      !mainIframe.includes('ads') &&
      !mainIframe.includes('kuramachat') &&
      !mainIframe.includes('/chat/') &&
      !mainIframe.includes('widget') &&
      mainIframe.includes('embed');  // Video embeds usually have 'embed' in URL
    
    if (isValidVideoIframe) {
      servers.push({
        name: 'Default Player',
        url: mainIframe.startsWith('//') ? `https:${mainIframe}` : mainIframe,
        quality: 'HD',
      });
    }

    // Extract servers from dropdown menu (kuramanime uses #changeServer select dropdown)
    const serverOptions = await page.evaluate(() => {
      const options: Array<{name: string; value: string}> = [];
      
      // Kuramanime uses select#changeServer for server selection
      const select = document.querySelector('#changeServer, select[id*="server"], select') as HTMLSelectElement | null;
      if (select) {
        Array.from(select.options).forEach(opt => {
          if (opt.value && opt.text) {
            options.push({
              name: opt.text.trim(),
              value: opt.value
            });
          }
        });
      }
      
      // Also try button-based servers (fallback)
      if (options.length === 0) {
        document.querySelectorAll('[data-video], .server-btn, .mirror-btn, button[onclick*="changeServer"]').forEach((btn: Element) => {
          const name = btn.textContent?.trim() || 'Server';
          const dataVideo = btn.getAttribute('data-video') || btn.getAttribute('onclick') || '';
          if (dataVideo) {
            options.push({
              name: name,
              value: dataVideo
            });
          }
        });
      }
      
      return options;
    });

    // Click each server option and capture iframe
    for (const serverOpt of serverOptions.slice(0, 10)) { // Limit to 10 servers
      try {
        // Click or select the server
        await page.evaluate((optValue) => {
          // Try select dropdown
          const select = document.querySelector('select') as HTMLSelectElement | null;
          if (select) {
            select.value = optValue;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
          // Try buttons
          const btn = document.querySelector(`[data-video="${optValue}"]`) as HTMLElement | null;
          if (btn) btn.click();
        }, serverOpt.value);

        await delay(1500);

        const newIframe = await page.$eval('iframe', el => el.src).catch(() => '');
        // Skip chat URLs, ads, and non-video content
        const isValidVideo = newIframe && 
          !newIframe.includes('kuramachat') &&
          !newIframe.includes('/chat/') &&
          !newIframe.includes('facebook') &&
          !newIframe.includes('ads') &&
          !servers.some(s => s.url === newIframe);
        
        if (isValidVideo) {
          servers.push({
            name: serverOpt.name,
            url: newIframe.startsWith('//') ? `https:${newIframe}` : newIframe,
            quality: 'HD',
          });
        }
      } catch (e) {
        // Ignore
      }
    }

    // Get prev/next
    const prevEpisode = await page.$eval('a[href*="episode"]:has-text("prev"), .prev-ep a', 
      el => el.getAttribute('href')?.match(/episode\/(\d+)/)?.[1] || ''
    ).catch(() => '');
    
    const nextEpisode = await page.$eval('a[href*="episode"]:has-text("next"), .next-ep a',
      el => el.getAttribute('href')?.match(/episode\/(\d+)/)?.[1] || ''
    ).catch(() => '');

    await browser.close();

    const detail: EpisodeDetail = {
      title: title || `Episode ${episodeNum}`,
      animeTitle: animeDetail.title,
      episodeNumber: episodeNum,
      servers,
      prevEpisode,
      nextEpisode,
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching episode detail from kuramanime:', error);
    return null;
  }
}

// Get anime by genre
export async function getAnimeByGenre(genre: string, page = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `kuramanime:genre:${genre}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/properties/genre/${genre}?page=${page}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    
    $('.product__item, .anime__item, .anime-card, [class*="anime"]').each((_, el) => {
      const anime = parseAnimeCard($, el);
      if (anime) animeList.push(anime);
    });

    const hasNext = $('.pagination .next, .page-item:last-child a').length > 0 &&
                   !$('.pagination .next, .page-item:last-child').hasClass('disabled');

    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching genre from kuramanime:', error);
    return { data: [], hasNext: false };
  }
}
