import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://anichin.id';
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
    // anichin.id uses /series/?status=ongoing pattern
    const url = `${BASE_URL}/series/?status=ongoing&page=${page}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, article.bs, .film-list .item').each((_, el) => {
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
        // Handle both /donghua/ and /series/ patterns
        let match = href.match(/\/donghua\/([^/]+)/);
        if (!match) {
          match = href.match(/\/series\/([^/]+)/);
        }
        slug = match ? match[1] : href.split('/').filter(Boolean).pop() || '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          status: 'Ongoing',
          rating: rating,
          url: `${BASE_URL}/series/${slug}/`,
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
    // anichin.id uses /series/?status=completed pattern
    const url = `${BASE_URL}/series/?status=completed&page=${page}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, article.bs, .film-list .item').each((_, el) => {
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
        // Handle both /donghua/ and /series/ patterns
        let match = href.match(/\/donghua\/([^/]+)/);
        if (!match) {
          match = href.match(/\/series\/([^/]+)/);
        }
        slug = match ? match[1] : href.split('/').filter(Boolean).pop() || '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        donghuaList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          status: 'Completed',
          rating: rating,
          url: `${BASE_URL}/series/${slug}/`,
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

    // Day mapping - Indonesian to English
    const dayMapId: Record<string, keyof typeof schedule> = {
      'senin': 'monday',
      'selasa': 'tuesday',
      'rabu': 'wednesday',
      'kamis': 'thursday',
      'jumat': 'friday',
      'sabtu': 'saturday',
      'minggu': 'sunday',
      'monday': 'monday',
      'tuesday': 'tuesday',
      'wednesday': 'wednesday',
      'thursday': 'thursday',
      'friday': 'friday',
      'saturday': 'saturday',
      'sunday': 'sunday',
    };

    // Strategy 1: Look for containers with sch_<dayname> class pattern
    Object.keys(dayMapId).forEach(dayName => {
      const selector = `.sch_${dayName}, [class*="sch_${dayName}"]`;
      $(selector).each((_, container) => {
        const $container = $(container);
        const day = dayMapId[dayName];
        
        $container.find('a[href*="/series/"], a[href*="/donghua/"]').each((_, el) => {
          const $link = $(el);
          const href = $link.attr('href') || '';
          const title = $link.attr('title') || $link.find('.tt, h4').text().trim() || $link.text().trim();
          const $parent = $link.closest('.bs, .bsh, .bsx, li, .schedule-item');
          const poster = $parent.find('img').attr('src') || $parent.find('img').attr('data-src') || '';
          const timeText = $parent.find('.epx, .time, [class*="time"]').text().trim();
          
          // Extract time
          const timeMatch = timeText.match(/(\d{1,2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : undefined;
          
          // Extract slug from URL
          let match = href.match(/\/donghua\/([^/]+)/);
          if (!match) match = href.match(/\/series\/([^/]+)/);
          const slug = match ? match[1] : '';
          
          if (slug && title && !schedule[day].some(item => item.slug === slug)) {
            schedule[day].push({
              title: title.substring(0, 100),
              slug,
              poster,
              time,
              url: `${BASE_URL}/series/${slug}/`,
            });
          }
        });
      });
    });

    // Strategy 2: Parse by h3 headers followed by items
    let currentDay: keyof typeof schedule | null = null;
    $('h3, .bs, .bsh, .bsx').each((_, el) => {
      const $el = $(el);
      const tagName = el.tagName?.toLowerCase();

      if (tagName === 'h3') {
        // Check if this is a day header
        const dayText = $el.text().trim().toLowerCase();
        for (const [key, value] of Object.entries(dayMapId)) {
          if (dayText.includes(key)) {
            currentDay = value;
            break;
          }
        }
      } else if (currentDay && ($el.hasClass('bs') || $el.hasClass('bsh') || $el.hasClass('bsx'))) {
        const linkEl = $el.find('a').first();
        const href = linkEl.attr('href') || '';
        const title = $el.find('.tt').text().trim() || linkEl.attr('title') || '';
        const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
        const timeText = $el.find('.epx, .time').text().trim();

        if (href && title) {
          let match = href.match(/\/donghua\/([^/]+)/);
          if (!match) match = href.match(/\/series\/([^/]+)/);
          const slug = match ? match[1] : '';
          
          const timeMatch = timeText.match(/(\d{1,2}:\d{2})/);
          const time = timeMatch ? timeMatch[1] : undefined;

          if (slug && !schedule[currentDay].some(item => item.slug === slug)) {
            schedule[currentDay].push({
              title: title.substring(0, 100),
              slug,
              poster,
              time,
              url: `${BASE_URL}/series/${slug}/`,
            });
          }
        }
      }
    });

    // Strategy 3: Find all .listupd items grouped by parent section
    $('.schedulepage .listupd, .releases .listupd').each((_, listupd) => {
      const $listupd = $(listupd);
      const $section = $listupd.closest('section, .schedule-section');
      const sectionText = $section.find('h3, h2, .section-title').text().trim().toLowerCase();
      
      let day: keyof typeof schedule | null = null;
      for (const [key, value] of Object.entries(dayMapId)) {
        if (sectionText.includes(key)) {
          day = value;
          break;
        }
      }
      
      if (day) {
        $listupd.find('.bs, .bsh, .bsx, a[href*="/series/"]').each((_, el) => {
          const $el = $(el);
          const linkEl = $el.is('a') ? $el : $el.find('a').first();
          const href = linkEl.attr('href') || '';
          const title = linkEl.attr('title') || $el.find('.tt, h4').text().trim();
          const poster = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
          
          let match = href.match(/\/series\/([^/]+)/);
          if (!match) match = href.match(/\/donghua\/([^/]+)/);
          const slug = match ? match[1] : '';
          
          if (slug && title && !schedule[day!].some(item => item.slug === slug)) {
            schedule[day!].push({
              title: title.substring(0, 100),
              slug,
              poster,
              url: `${BASE_URL}/series/${slug}/`,
            });
          }
        });
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

/**
 * Get donghua by season (year or seasonal like winter-2023)
 */
export async function getBySeason(season: string, page: number = 1): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:season:${season}:${page}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // For page 1, don't include /page/1/ in URL
    const url = page === 1 
      ? `${BASE_URL}/season/${season}/`
      : `${BASE_URL}/season/${season}/page/${page}/`;
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
      const rating = $el.find('.rating i').text().trim();
      const status = $el.find('.status').text().trim() || 
                     $el.find('.epx').text().trim();

      if (href && title) {
        let slug = '';
        if (href.includes('/donghua/')) {
          const match = href.match(/\/donghua\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = href.split('/').filter(Boolean).pop() || '';
        }
        
        if (!seen.has(slug)) {
          seen.add(slug);
          donghuaList.push({
            id: slug,
            title: title.substring(0, 120),
            slug,
            poster,
            type: 'Donghua',
            rating: rating || undefined,
            status: status || undefined,
            url: `${BASE_URL}/donghua/${slug}/`,
          });
        }
      }
    });

    const hasNext = $('.hpage .r, .pagination .next, .next.page-numbers, a.next, .nextpostslink').length > 0;
    const result = { data: donghuaList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching donghua by season:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get popular donghua from homepage "Popular Series" section
 * Supports period: 'weekly', 'monthly', 'all'
 */
export async function getPopularDonghua(period: string = 'weekly'): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:popular:${period}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Popular series is on homepage
    const html = await throttledRequest(BASE_URL);
    const $ = cheerio.load(html);

    const donghuaList: DonghuaItem[] = [];
    const seen = new Set<string>();

    // Tab index: 0 = Weekly, 1 = Monthly, 2 = All
    const tabIndex = period === 'weekly' ? 0 : period === 'monthly' ? 1 : 2;
    
    // Try multiple selector strategies for different Anichin domains
    let targetContainer: cheerio.Cheerio<any> | null = null;
    
    // Strategy 1: wpop-content containers (anichin.watch style)
    const wpopContainers = $('.wpop-content');
    if (wpopContainers.length > tabIndex) {
      targetContainer = $(wpopContainers[tabIndex]);
    } else if (wpopContainers.length > 0) {
      targetContainer = $(wpopContainers[0]);
    }
    
    // Strategy 2: serieslist containers (anichin.id style - has 3 serieslist elements)
    if (!targetContainer || targetContainer.find('li').length === 0) {
      const seriesLists = $('.serieslist');
      if (seriesLists.length > tabIndex) {
        targetContainer = $(seriesLists[tabIndex]);
      } else if (seriesLists.length > 0) {
        targetContainer = $(seriesLists[0]);
      }
    }
    
    // Strategy 3: ts-wpop-series widget
    if (!targetContainer || targetContainer.find('li').length === 0) {
      const tsWpop = $('.ts-wpop-series');
      if (tsWpop.length > 0) {
        const ulContainers = tsWpop.find('ul');
        if (ulContainers.length > tabIndex) {
          targetContainer = $(ulContainers[tabIndex]);
        } else if (ulContainers.length > 0) {
          targetContainer = $(ulContainers[0]);
        }
      }
    }
    
    // Strategy 4: General popular widget
    if (!targetContainer || targetContainer.find('li').length === 0) {
      const popularWidget = $('.widget_series_list, .widget-popular, [class*="popular"]');
      if (popularWidget.length > 0) {
        targetContainer = popularWidget.find('ul').first();
      }
    }
    
    if (targetContainer && targetContainer.length > 0) {
      // Parse items within the container
      targetContainer.find('li').each((index, el) => {
        const $el = $(el);
        
        // Get link - find first link (anichin.id uses /series/, others use /donghua/)
        const linkEl = $el.find('a').first();
        const href = linkEl.attr('href') || '';
        
        // Get title - try multiple selectors
        const title = $el.find('.series').text().trim() ||
                      $el.find('.leftseries h2').text().trim() ||
                      $el.find('.tt').text().trim() ||
                      $el.find('h4').text().trim() ||
                      $el.find('h3').text().trim() ||
                      linkEl.attr('title') || 
                      linkEl.text().trim() || '';
        
        // Get poster
        const poster = $el.find('img').attr('src') ||
                       $el.find('img').attr('data-src') || '';
        
        // Get rating
        const ratingEl = $el.find('.rating, .numscore, .rt, .score');
        let rating = '';
        if (ratingEl.length > 0) {
          rating = ratingEl.text().replace(/[^0-9.]/g, '').trim();
          // Clean up duplicated numbers like "8.838.838.83" -> "8.83"
          if (rating.length > 5) {
            rating = rating.substring(0, 4);
          }
        }
        
        // Get genres
        const genres: string[] = [];
        $el.find('.genpost a, .genre a, a[href*="/genres/"]').each((_, genreEl) => {
          genres.push($(genreEl).text().trim());
        });

        if (href && title) {
          // Match both /donghua/ and /series/ patterns 
          let match = href.match(/\/donghua\/([^/]+)/);
          if (!match) {
            match = href.match(/\/series\/([^/]+)/);
          }
          const slug = match ? match[1] : '';
          
          if (slug && !seen.has(slug)) {
            seen.add(slug);
            donghuaList.push({
              id: slug,
              title: title.substring(0, 120),
              slug,
              poster,
              type: 'Donghua',
              rating: rating || undefined,
              genres: genres.length > 0 ? genres : undefined,
              url: `${BASE_URL}/donghua/${slug}/`,
            });
          }
        }
      });
    }

    const result = { data: donghuaList, hasNext: false };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching popular donghua:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get available seasons list
 */
export async function getSeasonsList(): Promise<{ year: string[]; seasonal: { name: string; slug: string }[] }> {
  const cacheKey = 'anichin:seasons-list';
  const cached = await getCached<{ year: string[]; seasonal: { name: string; slug: string }[] }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/donghua/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const years: string[] = [];
    const seasonal: { name: string; slug: string }[] = [];

    // Parse season links from sidebar
    $('a[href*="/season/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      
      const match = href.match(/\/season\/([^/]+)/);
      if (match) {
        const seasonSlug = match[1];
        // Check if it's a year (4 digits) or seasonal (like winter-2023)
        if (/^\d{4}$/.test(seasonSlug)) {
          if (!years.includes(seasonSlug)) {
            years.push(seasonSlug);
          }
        } else if (seasonSlug.includes('-')) {
          const name = text.replace(/\d+$/, '').trim(); // Remove count number
          if (!seasonal.find(s => s.slug === seasonSlug)) {
            seasonal.push({ name: name || seasonSlug, slug: seasonSlug });
          }
        }
      }
    });

    // Sort years descending
    years.sort((a, b) => parseInt(b) - parseInt(a));

    const result = { year: years, seasonal };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching seasons list:', error);
    return { year: [], seasonal: [] };
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
  getBySeason,
  getSeasonsList,
};
