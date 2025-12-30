import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://samehadaku.li';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between requests

// Axios instance with headers to avoid blocking
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

// Helper to extract anime slug from episode URL
function extractAnimeSlugFromEpisodeUrl(episodeUrl: string): string {
  // Episode URL: https://samehadaku.li/one-piece-episode-1155-subtitle-indonesia/
  // We need to extract: one-piece
  const parts = episodeUrl.split('/').filter(Boolean).pop() || '';
  // Remove episode suffix and subtitle-indonesia
  let slug = parts
    .replace(/-episode-\d+.*$/i, '')
    .replace(/-subtitle-indonesia$/i, '')
    .replace(/-sub-indo$/i, '');
  return slug;
}

/**
 * Get latest anime from homepage (with pagination)
 */
export async function getLatestAnime(page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `samehadaku:latest:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Use homepage with pagination for latest updates
    const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    // Parse anime/episode items from homepage
    $('.post-show ul li, .listupd .bs, .bsx, article.bs, .animpost').each((_, el) => {
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
        // Extract slug - handle both episode URLs and anime series URLs
        let slug = '';
        
        if (href.includes('/anime/')) {
          // Direct anime series link: /anime/slug/
          const match = href.match(/\/anime\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          // Episode link: /anime-name-episode-123-subtitle-indonesia/
          // Extract anime name from episode URL
          slug = extractAnimeSlugFromEpisodeUrl(href);
        }
        
        // Clean title - remove episode info
        title = title.replace(/Episode\s*\d+.*$/i, '').trim();
        title = title.substring(0, 100);
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title,
          slug: slug,
          poster: poster,
          type: type || 'TV',
          status: status,
          latestEpisode: episode,
          url: `${BASE_URL}/anime/${slug}/`,
        });
      }
    });

    const hasNext = $('.hpage .r, .pagination .next, .next.page-numbers, a.next, .nextpostslink').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching latest anime:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get ongoing anime (filter from anime list by status)
 */
export async function getOngoingAnime(page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `samehadaku:ongoing:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Use status filter endpoint if available, otherwise use anime list
    const url = `${BASE_URL}/anime/?status=ongoing&page=${page}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, .animepost, article.bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      let title = $el.find('.tt h2').text().trim() ||
                  $el.find('.tt').text().trim() ||
                  $el.find('.title').text().trim() ||
                  linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      
      const rating = $el.find('.rating i').text().trim() ||
                     $el.find('.score').text().trim();

      if (href && title) {
        let slug = '';
        if (href.includes('/anime/')) {
          const match = href.match(/\/anime\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = href.split('/').filter(Boolean).pop() || '';
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          status: 'Ongoing',
          rating: rating,
          url: `${BASE_URL}/anime/${slug}/`,
        });
      }
    });

    const hasNext = $('.pagination .next, .hpage .r, a.next').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching ongoing anime:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Search anime by query
 */
export async function searchAnime(query: string, page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `samehadaku:search:${query}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, .animepost').each((_, el) => {
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
        if (href.includes('/anime/')) {
          const match = href.match(/\/anime\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          // Might be episode link, extract anime slug
          slug = extractAnimeSlugFromEpisodeUrl(href);
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          type: type || 'TV',
          url: `${BASE_URL}/anime/${slug}/`,
        });
      }
    });

    const hasNext = $('.pagination .next, .hpage .r').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error searching anime:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get anime detail by slug
 */
export async function getAnimeDetail(slug: string): Promise<AnimeDetail | null> {
  const cacheKey = `samehadaku:detail:${slug}`;
  const cached = await getCached<AnimeDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/anime/${slug}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const title = $('.entry-title, h1.entry-title, .infox h1').first().text().trim();
    const poster = $('.thumb img, .bigcover img, .info img').attr('src') || '';
    const synopsis = $('.entry-content p, .synops p, .desc, .sinopsis p').first().text().trim() ||
                     $('.entry-content').text().trim();

    // Extract info
    const info: Record<string, string> = {};
    $('.spe span, .info-content span, .infox .spe span').each((_, el) => {
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

    const detail: AnimeDetail = {
      id: slug,
      title: title || slug,
      slug: slug,
      poster: poster,
      synopsis: synopsis || 'Tidak ada sinopsis.',
      type: info['type'] || info['tipe'] || 'TV',
      status: info['status'] || '',
      score: info['score'] || info['skor'] || '',
      duration: info['duration'] || info['durasi'] || '',
      studio: info['studio'] || '',
      season: info['season'] || info['musim'] || '',
      released: info['released'] || info['rilis'] || '',
      totalEpisodes: info['episodes'] || info['episode'] || '',
      genres: genres,
      episodes: episodes.reverse(),
      url: url,
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching anime detail:', error);
    return null;
  }
}

/**
 * Get episode streaming data
 */
export async function getEpisodeDetail(slug: string): Promise<EpisodeDetail | null> {
  const cacheKey = `samehadaku:episode:${slug}`;
  const cached = await getCached<EpisodeDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/${slug}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const title = $('.entry-title, h1.entry-title').first().text().trim();
    const animeTitle = title.split('Episode')[0].trim();
    const episodeNumber = title.match(/Episode\s*(\d+)/i)?.[1] || '';

    const servers: StreamServer[] = [];
    
    // Find video iframes
    $('iframe').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.includes('facebook') && !src.includes('twitter')) {
        servers.push({
          name: 'Player',
          url: src,
          quality: 'HD',
        });
      }
    });

    // Find server options
    $('.player-embed .mirror-items a, .pemain a, .server-list a, select option').each((_, el) => {
      const dataUrl = $(el).attr('data-url') || $(el).attr('data-video') || $(el).attr('value') || '';
      const serverName = $(el).text().trim();
      
      if (dataUrl && dataUrl.startsWith('http')) {
        servers.push({
          name: serverName || 'Server',
          url: dataUrl,
          quality: serverName.includes('720') ? '720p' : serverName.includes('1080') ? '1080p' : 'HD',
        });
      }
    });

    const prevEpisode = $('.prevnext .prev a, .naveps .prev a').attr('href')?.split('/').filter(Boolean).pop();
    const nextEpisode = $('.prevnext .next a, .naveps .next a').attr('href')?.split('/').filter(Boolean).pop();

    const detail: EpisodeDetail = {
      title: title,
      animeTitle: animeTitle,
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
 * Get anime by genre
 */
export async function getAnimeByGenre(genre: string, page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `samehadaku:genre:${genre}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/genre/${genre}/page/${page}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    $('.listupd .bs, .bsx, .animepost').each((_, el) => {
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
        if (href.includes('/anime/')) {
          const match = href.match(/\/anime\/([^/]+)/);
          slug = match ? match[1] : '';
        } else {
          slug = href.split('/').filter(Boolean).pop() || '';
        }
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        animeList.push({
          id: slug,
          title: title.substring(0, 100),
          slug: slug,
          poster: poster,
          url: `${BASE_URL}/anime/${slug}/`,
        });
      }
    });

    const hasNext = $('.pagination .next, .hpage .r').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching anime by genre:', error);
    return { data: [], hasNext: false };
  }
}

export default {
  getLatestAnime,
  getOngoingAnime,
  searchAnime,
  getAnimeDetail,
  getEpisodeDetail,
  getAnimeByGenre,
};
