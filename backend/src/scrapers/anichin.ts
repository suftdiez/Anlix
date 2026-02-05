import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://anichin.watch';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between requests

// Axios instance with headers
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
  },
  timeout: 15000,
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

export interface DonghuaItem {
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
}

export interface DonghuaDetail extends DonghuaItem {
  synopsis: string;
  score?: string;
  duration?: string;
  studio?: string;
  season?: string;
  released?: string;
  totalEpisodes?: string;
  episodes: Episode[];
  alternativeTitles?: string[];
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
  donghuaTitle: string;
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

export interface ScheduleItem {
  title: string;
  slug: string;
  poster?: string;
  time?: string; // Release time like "08:57"
  episode?: string;
  url: string;
}

export interface Schedule {
  [day: string]: ScheduleItem[];
}

// Helper to get cached data (Redis with in-memory fallback)
async function getCached<T>(key: string): Promise<T | null> {
  // Try Redis first
  const redisCache = await redis.get(key);
  if (redisCache) {
    return JSON.parse(redisCache) as T;
  }
  
  // Try in-memory cache
  const memCache = memoryCache.get(key);
  if (memCache && memCache.expiry > Date.now()) {
    return JSON.parse(memCache.data) as T;
  }
  
  // Clean expired memory cache
  if (memCache) {
    memoryCache.delete(key);
  }
  
  return null;
}

// Helper to set cache (both Redis and in-memory)
async function setCache(key: string, data: unknown): Promise<void> {
  const jsonData = JSON.stringify(data);
  
  // Set Redis cache
  await redis.set(key, jsonData, CACHE_TTL);
  
  // Also set in-memory cache as fallback
  memoryCache.set(key, {
    data: jsonData,
    expiry: Date.now() + (CACHE_TTL * 1000),
  });
  
  // Clean old memory cache entries (keep max 100)
  if (memoryCache.size > 100) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, 20);
    keysToDelete.forEach(k => memoryCache.delete(k));
  }
}

/**
 * Get latest donghua from homepage (with pagination)
 */
export async function getLatestDonghua(page: number = 1): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:latest:${page}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Use homepage with pagination for latest updates
    const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    // Parse donghua/episode items from homepage
    $('.listupd .bs, .bsx, article.bs, .animpost').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      // Get title
      let title = $el.find('.tt h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  $el.find('.title').text().trim() ||
                  $el.find('h2').text().trim() ||
                  linkEl.attr('title') || '';
      
      // Get poster
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') ||
                     $el.find('img').attr('data-lazy-src') || '';
      
      const episode = $el.find('.epx').text().trim() ||
                      $el.find('.sb').text().trim();
      const type = $el.find('.typez').text().trim() ||
                   $el.find('.type').text().trim();
      const status = $el.find('.status').text().trim();

      if (href && title) {
        // Extract slug - handle both donghua series URLs and episode URLs
        let slug = '';
        
        if (href.includes('/donghua/')) {
          // Direct donghua series link: /donghua/slug/
          const match = href.match(/\/donghua\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          // Episode link: /donghua-name-episode-123-subtitle-indonesia/
          // Extract donghua name from episode URL
          const parts = href.split('/').filter(Boolean).pop() || '';
          slug = parts.replace(/-episode-\d+.*$/i, '').replace(/-subtitle-indonesia$/i, '');
        }
        
        // Clean title - remove episode info
        title = title.replace(/Episode\s*\d+.*$/i, '').trim();
        title = title.substring(0, 100);
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title,
          slug: slug,
          poster: poster,
          type: type || 'Donghua',
          status: status,
          latestEpisode: episode,
          url: `${BASE_URL}/donghua/${slug}/`,
        });
      }
    });

    const hasNext = $('.hpage .r, .pagination .next, .next.page-numbers, a.next, .nextpostslink').length > 0;
    const result = { data: donghuaList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching latest donghua:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get ongoing donghua
 */
export async function getOngoingDonghua(page: number = 1): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:ongoing:${page}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/donghua/?status=ongoing&page=${page}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, article.bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.tt h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  $el.find('.title').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      const rating = $el.find('.rating i').text().trim();

      if (href && title) {
        let slug = '';
        if (href.includes('/donghua/')) {
          const match = href.match(/\/donghua\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = href.split('/').filter(Boolean).pop() || '';
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          status: 'Ongoing',
          rating: rating,
          url: `${BASE_URL}/donghua/${slug}/`,
        });
      }
    });

    const hasNext = $('.hpage .r, .pagination .next, a.next').length > 0;
    const result = { data: donghuaList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching ongoing donghua:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get completed donghua
 */
export async function getCompletedDonghua(page: number = 1): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:completed:${page}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/donghua/?status=completed&page=${page}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, article.bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.tt h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  $el.find('.title').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      const rating = $el.find('.rating i').text().trim();

      if (href && title) {
        let slug = '';
        if (href.includes('/donghua/')) {
          const match = href.match(/\/donghua\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = href.split('/').filter(Boolean).pop() || '';
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          status: 'Completed',
          rating: rating,
          url: `${BASE_URL}/donghua/${slug}/`,
        });
      }
    });

    const hasNext = $('.hpage .r, .pagination .next, a.next').length > 0;
    const result = { data: donghuaList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching completed donghua:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Search donghua by query
 */
export async function searchDonghua(query: string, page: number = 1): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:search:${query}:${page}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, article.bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.tt h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  $el.find('.title').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      const type = $el.find('.typez').text().trim();

      if (href && title) {
        let slug = '';
        if (href.includes('/donghua/')) {
          const match = href.match(/\/donghua\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          // Episode URL - extract donghua slug
          const parts = href.split('/').filter(Boolean).pop() || '';
          slug = parts.replace(/-episode-\d+.*$/i, '').replace(/-subtitle-indonesia$/i, '');
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          type: type || 'Donghua',
          url: `${BASE_URL}/donghua/${slug}/`,
        });
      }
    });

    const hasNext = $('.hpage .r, .pagination .next').length > 0;
    const result = { data: donghuaList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error searching donghua:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get donghua detail by slug
 */
export async function getDonghuaDetail(slug: string): Promise<DonghuaDetail | null> {
  const cacheKey = `anichin:detail:${slug}`;
  const cached = await getCached<DonghuaDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/donghua/${slug}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const title = $('.entry-title, h1.entry-title, .infox h1').first().text().trim();
    const poster = $('.thumb img, .info img, .bigcover img').attr('src') || '';
    const synopsis = $('.synopis p, .entry-content p, .synopsis p, .sinopsis p').first().text().trim() ||
                     $('.entry-content').text().trim();

    // Extract info
    const info: Record<string, string> = {};
    $('.infox .spe span, .info-content .spe span, .spe span').each((_, el) => {
      const text = $(el).text();
      const [key, ...valueParts] = text.split(':');
      if (key && valueParts.length) {
        info[key.trim().toLowerCase()] = valueParts.join(':').trim();
      }
    });

    // Extract genres
    const genres: string[] = [];
    $('.genxed a, .genre-info a, .info a[href*="genre"]').each((_, el) => {
      genres.push($(el).text().trim());
    });

    // Extract alternative titles
    const alternativeTitles: string[] = [];
    $('.alter, .alternative').text().split(',').forEach(alt => {
      if (alt.trim()) alternativeTitles.push(alt.trim());
    });

    // Extract episodes
    const episodes: Episode[] = [];
    $('.eplister ul li a, .episodelist ul li a, .listeps ul li a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const episodeTitle = $el.find('.epl-title').text().trim() || 
                           $el.find('.eptitle').text().trim() ||
                           $el.text().trim();
      const episodeNum = $el.find('.epl-num').text().trim() || 
                         episodeTitle.match(/(\d+)/)?.[1] || '';
      const date = $el.find('.epl-date').text().trim();

      if (href) {
        const epSlug = href.split('/').filter(Boolean).pop() || '';
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

    const detail: DonghuaDetail = {
      id: slug,
      title: title || slug,
      slug: slug,
      poster: poster,
      synopsis: synopsis || 'Tidak ada sinopsis.',
      type: info['type'] || info['tipe'] || 'Donghua',
      status: info['status'] || '',
      score: info['score'] || info['skor'] || '',
      duration: info['duration'] || info['durasi'] || '',
      studio: info['studio'] || '',
      season: info['season'] || info['musim'] || '',
      released: info['released'] || info['rilis'] || info['year'] || '',
      totalEpisodes: info['episodes'] || info['episode'] || '',
      genres: genres,
      alternativeTitles: alternativeTitles,
      episodes: episodes.reverse(),
      url: url,
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching donghua detail:', error);
    return null;
  }
}

/**
 * Get episode streaming data
 */
export async function getEpisodeDetail(slug: string): Promise<EpisodeDetail | null> {
  const cacheKey = `anichin:episode:${slug}`;
  const cached = await getCached<EpisodeDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/${slug}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const title = $('.entry-title, h1.entry-title').first().text().trim();
    const donghuaTitle = title.split('Episode')[0].trim();
    const episodeNumber = title.match(/Episode\s*(\d+)/i)?.[1] || '';

    const servers: StreamServer[] = [];
    const seenUrls = new Set<string>();

    // Find video iframes (default player)
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('facebook') && !src.includes('twitter') && !src.includes('ads') && !seenUrls.has(src)) {
        seenUrls.add(src);
        servers.push({
          name: 'Default Player',
          url: src,
          quality: 'HD',
        });
      }
    });

    // Find server options from select.mirror dropdown
    // Anichin stores Base64-encoded iframe HTML in the value attribute
    $('select.mirror option, .mirror option').each((_, el) => {
      const value = $(el).attr('value') || '';
      const text = $(el).text().trim();
      
      // Skip empty or placeholder options
      if (!value || text.toLowerCase().includes('pilih') || text.toLowerCase().includes('select')) {
        return;
      }
      
      // Try direct URL first
      if (value.startsWith('http') && !seenUrls.has(value)) {
        seenUrls.add(value);
        servers.push({
          name: text || 'Server',
          url: value,
          quality: text.includes('720') ? '720p' : text.includes('1080') ? '1080p' : 'HD',
        });
        return;
      }
      
      // Try Base64 decoding (Anichin stores iframe HTML as Base64)
      if (value.match(/^[A-Za-z0-9+/=]{20,}$/)) {
        try {
          const decoded = Buffer.from(value, 'base64').toString('utf-8');
          // Extract iframe src from decoded HTML
          const iframeSrcMatch = decoded.match(/src=["']([^"']+)["']/);
          if (iframeSrcMatch && iframeSrcMatch[1]) {
            const iframeSrc = iframeSrcMatch[1];
            if (!seenUrls.has(iframeSrc)) {
              seenUrls.add(iframeSrc);
              servers.push({
                name: text || 'Server',
                url: iframeSrc,
                quality: text.includes('720') ? '720p' : text.includes('1080') ? '1080p' : 'HD',
              });
            }
          } else if (decoded.startsWith('http') && !seenUrls.has(decoded)) {
            // Direct URL as Base64
            seenUrls.add(decoded);
            servers.push({
              name: text || 'Server',
              url: decoded,
              quality: 'HD',
            });
          }
        } catch {
          // Not valid Base64, skip
        }
      }
    });

    const prevEpisode = $('.naveps .prev a, .prevnext .prev a').attr('href')?.split('/').filter(Boolean).pop();
    const nextEpisode = $('.naveps .next a, .prevnext .next a').attr('href')?.split('/').filter(Boolean).pop();

    const detail: EpisodeDetail = {
      title: title,
      donghuaTitle: donghuaTitle,
      episodeNumber: episodeNumber,
      servers: servers,
      prevEpisode: prevEpisode,
      nextEpisode: nextEpisode,
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching episode detail:', error);
    return null;
  }
}


/**
 * Get donghua by genre
 */
export async function getDonghuaByGenre(genre: string, page: number = 1): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:genre:${genre}:${page}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/genres/${genre}/page/${page}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, article.bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.tt h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  $el.find('.title').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';

      if (href && title) {
        let slug = '';
        if (href.includes('/donghua/')) {
          const match = href.match(/\/donghua\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = href.split('/').filter(Boolean).pop() || '';
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          url: `${BASE_URL}/donghua/${slug}/`,
        });
      }
    });

    const hasNext = $('.hpage .r, .pagination .next').length > 0;
    const result = { data: donghuaList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching donghua by genre:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get popular donghua
 */
export async function getPopularDonghua(): Promise<DonghuaItem[]> {
  const cacheKey = 'anichin:popular';
  const cached = await getCached<DonghuaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data: html } = await axiosInstance.get(BASE_URL);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    $('.serieslist.pop li, .widget_series_list li, .popbx .bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.leftseries h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      const rating = $el.find('.rating').text().trim();

      if (href && title) {
        let slug = '';
        if (href.includes('/donghua/')) {
          const match = href.match(/\/donghua\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = href.split('/').filter(Boolean).pop() || '';
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          rating: rating,
          url: `${BASE_URL}/donghua/${slug}/`,
        });
      }
    });

    await setCache(cacheKey, donghuaList);
    return donghuaList;
  } catch (error) {
    console.error('Error fetching popular donghua:', error);
    return [];
  }
}

/**
 * Get donghua release schedule by day
 */
export async function getSchedule(): Promise<Schedule> {
  const cacheKey = 'anichin:schedule';
  const cached = await getCached<Schedule>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/schedule/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const schedule: Schedule = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    // Day mapping
    const dayMap: Record<string, keyof typeof schedule> = {
      'monday': 'monday',
      'tuesday': 'tuesday',
      'wednesday': 'wednesday',
      'thursday': 'thursday',
      'friday': 'friday',
      'saturday': 'saturday',
      'sunday': 'sunday',
    };

    // Each day is in a section with class .schedulepage or similar structure
    // The schedule page has h3 headers with day names followed by donghua items
    let currentDay: keyof typeof schedule | null = null;

    // Parse schedule sections - look for day headers
    $('h3, .bsx').each((_, el) => {
      const $el = $(el);
      const tagName = el.tagName?.toLowerCase();

      if (tagName === 'h3') {
        // This is a day header
        const dayText = $el.text().trim().toLowerCase();
        for (const [key, value] of Object.entries(dayMap)) {
          if (dayText.includes(key)) {
            currentDay = value;
            break;
          }
        }
      } else if (currentDay && $el.hasClass('bsx')) {
        // This is a donghua item under current day
        const linkEl = $el.find('a').first();
        const href = linkEl.attr('href') || '';
        const title = $el.find('.tt').text().trim() || linkEl.attr('title') || '';
        const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
        const timeText = $el.find('.epx').text().trim() || '';

        if (href && title) {
          const match = href.match(/\/donghua\/([^/]+)/);
          const slug = match ? match[1] : href.split('/').filter(Boolean).pop() || '';

          // Extract time (format: "at 08:57" or similar)
          const timeMatch = timeText.match(/(\d{1,2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : undefined;

          // Extract episode number from the text
          const epMatch = timeText.match(/(\d+)$/);
          const episode = epMatch ? `Episode ${epMatch[1]}` : undefined;

          schedule[currentDay].push({
            title: title.substring(0, 100),
            slug,
            poster,
            time,
            episode,
            url: `${BASE_URL}/donghua/${slug}/`,
          });
        }
      }
    });

    // Alternative parsing: look for list items within schedule sections
    $('.schedule-item, .listupd .bs, .schedulepage .bsx').each((_, el) => {
      const $el = $(el);
      const $parent = $el.closest('.schedule-day, [data-day]');
      const dayAttr = $parent.attr('data-day') || '';
      
      let day: keyof typeof schedule | null = null;
      for (const [key, value] of Object.entries(dayMap)) {
        if (dayAttr.toLowerCase().includes(key)) {
          day = value;
          break;
        }
      }

      if (day) {
        const linkEl = $el.find('a').first();
        const href = linkEl.attr('href') || '';
        const title = $el.find('.tt').text().trim() || linkEl.attr('title') || '';
        const poster = $el.find('img').attr('src') || '';
        const time = $el.find('.time, .epx').first().text().trim().match(/(\d{1,2}:\d{2})/)?.[1];

        if (href && title) {
          const match = href.match(/\/donghua\/([^/]+)/);
          const slug = match ? match[1] : '';
          
          // Avoid duplicates
          if (slug && !schedule[day].some(item => item.slug === slug)) {
            schedule[day].push({
              title: title.substring(0, 100),
              slug,
              poster,
              time,
              url: `${BASE_URL}/donghua/${slug}/`,
            });
          }
        }
      }
    });

    await setCache(cacheKey, schedule);
    return schedule;
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
  }
}

export default {
  getLatestDonghua,
  getOngoingDonghua,
  getCompletedDonghua,
  searchDonghua,
  getDonghuaDetail,
  getEpisodeDetail,
  getDonghuaByGenre,
  getPopularDonghua,
  getSchedule,
};
