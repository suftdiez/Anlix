/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import axios from 'axios';
import * as cheerio from 'cheerio';
// Puppeteer removed - Subnime works with Cheerio since data-url attributes are in static HTML
import redis from '../config/redis';

const BASE_URL = 'https://subnime.com';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

// Axios instance with headers
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://www.google.com/',
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

// ============ INTERFACES ============

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
  source: 'subnime';
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

// ============ CACHE HELPERS ============

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

// Puppeteer helper removed - using throttledRequest (axios) for all requests

// ============ SCRAPER FUNCTIONS ============

/**
 * Search anime by query
 */
export async function searchAnime(query: string, page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `subnime:search:${query}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    // Search results: .anime-card is a DIV container, link inside .card-title a
    // Also handle homepage .anime-card which IS an anchor tag
    $('.anime-card').each((_, el) => {
      const $el = $(el);
      
      // Get the link - could be from .card-title a (search page) or from the card itself (homepage)
      let href = '';
      let title = '';
      
      const cardTitleLink = $el.find('.card-title a');
      if (cardTitleLink.length) {
        // Search result page structure
        href = cardTitleLink.attr('href') || '';
        title = cardTitleLink.text().trim();
      } else if ($el.is('a')) {
        // Homepage structure where .anime-card IS the anchor
        href = $el.attr('href') || '';
        title = $el.find('.anime-title').text().trim() || $el.attr('title') || '';
      } else {
        // Try any child anchor
        const anyLink = $el.find('a[href*="/anime/"]').first();
        href = anyLink.attr('href') || '';
        title = anyLink.text().trim() || $el.find('h3').text().trim();
      }
      
      // Only process /anime/ links
      if (!href.includes('/anime/')) return;
      
      const slugMatch = href.match(/\/anime\/([^/]+)/);
      if (!slugMatch) return;
      const slug = slugMatch[1];
      
      if (seen.has(slug)) return;
      seen.add(slug);
      
      // Clean title (remove extra whitespace)
      title = title.replace(/\s+/g, ' ').trim().substring(0, 150);
      if (!title || title.length < 2) return;
      
      // Get poster - from .card-poster img or .anime-poster
      const poster = $el.find('.card-poster img, img.anime-poster, img').first().attr('src') ||
                     $el.find('img').attr('data-src') || '';
      
      // Get episode badge
      const latestEpisode = $el.find('.episode-badge').text().trim() || '';
      
      // Get rating from overlay-info
      const ratingEl = $el.find('.info-item').filter((_, item) => $(item).find('.fa-star').length > 0);
      const rating = ratingEl.text().replace(/[^\d.]/g, '').trim() || '';
      
      // Get type from overlay-info  
      const typeEl = $el.find('.info-item').filter((_, item) => $(item).find('.fa-tv').length > 0);
      const type = typeEl.text().trim() || '';
      
      // Get status badge
      const status = $el.find('.status-badge').text().trim() || '';
      
      animeList.push({
        id: `subnime-${slug}`,
        title,
        slug: `subnime-${slug}`,
        poster: poster.startsWith('http') ? poster : poster ? `${BASE_URL}${poster}` : '',
        type: type || 'TV',
        status: status || undefined,
        rating: rating || undefined,
        latestEpisode: latestEpisode || undefined,
        url: `${BASE_URL}/anime/${slug}`,
        source: 'subnime',
      });
    });

    // Check for next page
    const hasNext = $('a[rel="next"], .pagination .next, a:contains("Next")').length > 0;
    
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error searching anime on subnime:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get anime detail by slug (uses Puppeteer with dropdown interaction for ALL episodes)
 */
export async function getAnimeDetail(slug: string): Promise<AnimeDetail | null> {
  const cacheKey = `subnime:detail:${slug}`;
  const cached = await getCached<AnimeDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/anime/${slug}`;
    
    // Use Cheerio instead of Puppeteer - Subnime serves episode links in static HTML
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    // Title
    const title = $('.hero-title').text().trim() ||
                  $('h1').first().text().trim() ||
                  $('title').text().replace(/\s*\|.*$/, '').replace(/^Nonton\s+/, '').trim();

    if (!title) return null;

    // Poster
    const poster = $('.hero-poster img, .poster img, img[class*="poster"]').attr('src') || 
                   $('meta[property="og:image"]').attr('content') || '';

    // Synopsis
    const synopsis = $('.hero-description').text().trim() ||
                     $('.synopsis').text().trim() ||
                     $('meta[property="og:description"]').attr('content') || 
                     'Tidak ada sinopsis.';

    // Info fields
    const info: Record<string, string> = {};
    $('.info-item, .detail-info span, .anime-meta span').each((_, el) => {
      const text = $(el).text().trim();
      const [key, ...valueParts] = text.split(':');
      if (key && valueParts.length) {
        info[key.trim().toLowerCase()] = valueParts.join(':').trim();
      }
    });

    $('h3').each((_, el) => {
      const label = $(el).text().trim().toLowerCase();
      const value = $(el).next().text().trim() || $(el).parent().text().replace($(el).text(), '').trim();
      if (label && value && value.length < 200) {
        info[label] = value;
      }
    });

    // Genres
    const genres: string[] = [];
    $('a[href*="genre"], .genre-badge').each((_, el) => {
      const genre = $(el).text().trim();
      if (genre && !genres.includes(genre)) {
        genres.push(genre);
      }
    });

    // ===== EPISODES: Extract from inline JavaScript =====
    // Subnime embeds all episodes as JSON in a script tag: const allEpisodes = [{...}, ...]
    const episodes: Episode[] = [];
    const seenEps = new Set<string>();

    // Method 1: Extract allEpisodes JSON array from inline script
    const allEpisodesMatch = html.match(/const\s+allEpisodes\s*=\s*(\[[\s\S]*?\]);/);
    if (allEpisodesMatch) {
      try {
        const episodeData = JSON.parse(allEpisodesMatch[1]);
        if (Array.isArray(episodeData)) {
          for (const ep of episodeData) {
            const epNum = String(ep.episode_number || '');
            if (!epNum || seenEps.has(epNum)) continue;
            seenEps.add(epNum);

            const epSlug = `${slug}-episode-${epNum}`;
            const epTitle = ep.title ? `Episode ${epNum}: ${ep.title}` : `Episode ${epNum}`;

            episodes.push({
              id: String(ep.id || epSlug),
              number: epNum,
              title: epTitle,
              slug: epSlug,
              url: `${BASE_URL}/${epSlug}`,
            });
          }
        }
      } catch (e) {
        // JSON parse failed, fall through to fallback
      }
    }

    // Method 2: Fallback - try DOM links (in case site structure changes)
    if (episodes.length === 0) {
      $('a.episode-grid-item, a.episode-list-item, a[href*="episode-"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();
        
        if (!href || !href.includes('episode')) return;
        
        const epNumMatch = text.match(/(\d+)/) || href.match(/episode-(\d+)/);
        const epNum = epNumMatch ? epNumMatch[1] : '';
        const epSlug = href.split('/').filter(Boolean).pop() || '';
        
        if (seenEps.has(epNum) || !epSlug || !epNum) return;
        seenEps.add(epNum);
        
        episodes.push({
          id: epSlug,
          number: epNum,
          title: `Episode ${epNum}`,
          slug: epSlug,
          url: href.startsWith('http') ? href : `${BASE_URL}/${epSlug}`,
        });
      });
    }

    // Method 3: Fallback - generate from total episode count + slug pattern
    if (episodes.length === 0) {
      const totalEpStr = info['episode'] || info['episodes'] || '';
      const totalEp = parseInt(totalEpStr) || 0;
      if (totalEp > 0) {
        for (let i = 1; i <= totalEp; i++) {
          const epSlug = `${slug}-episode-${i}`;
          episodes.push({
            id: epSlug,
            number: String(i),
            title: `Episode ${i}`,
            slug: epSlug,
            url: `${BASE_URL}/${epSlug}`,
          });
        }
      }
    }

    // Sort episodes by number
    episodes.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    const detail: AnimeDetail = {
      id: slug,
      title,
      slug,
      poster: poster.startsWith('http') ? poster : poster ? `${BASE_URL}${poster}` : '',
      synopsis,
      type: info['type'] || info['tipe'] || 'TV',
      status: info['status'] || '',
      score: info['rating'] || info['score'] || '',
      duration: info['duration'] || info['durasi'] || '',
      studio: info['studio'] || '',
      season: info['season'] || '',
      released: info['aired'] || info['released'] || info['rilis'] || '',
      totalEpisodes: info['episode'] || info['episodes'] || String(episodes.length) || '',
      genres,
      episodes,
      url: url,
      source: 'subnime',
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching anime detail from subnime:', error);
    return null;
  }
}

/**
 * Get episode streaming data (uses Puppeteer for dynamic server buttons)
 */
export async function getEpisodeDetail(slug: string): Promise<EpisodeDetail | null> {
  const cacheKey = `subnime:episode:${slug}`;
  const cached = await getCached<EpisodeDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/${slug}`;
    
    // Use Cheerio - server buttons with data-url are in static HTML
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    // Title
    const fullTitle = $('h2').first().text().trim() ||
                      $('h1').first().text().trim() ||
                      $('title').text().replace(/\s*\|.*$/, '').trim();
    
    // Extract anime title and episode number from slug or title
    const epMatch = slug.match(/^(.+)-episode-(\d+)$/);
    const animeTitle = epMatch ? epMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : fullTitle;
    const episodeNumber = epMatch ? epMatch[2] : (fullTitle.match(/Episode\s*(\d+)/i)?.[1] || '');

    // Extract servers from .server-btn with data-url
    const servers: StreamServer[] = [];
    
    // Helper: fetch an embed page and extract the real video iframe URL inside it
    const extractRealVideoUrl = async (embedUrl: string): Promise<string> => {
      try {
        const resp = await axios.get(embedUrl, {
          headers: {
            'Referer': 'https://subnime.com/',
            'Origin': 'https://subnime.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 10000,
        });
        const embed$ = cheerio.load(resp.data);
        // Look for the inner iframe (typically Blogger video or other player)
        const innerSrc = embed$('iframe').attr('src') || '';
        if (innerSrc && (innerSrc.includes('blogger.com') || innerSrc.includes('video.g') || innerSrc.includes('drive.google'))) {
          return innerSrc;
        }
        // If no recognized inner iframe, return the original URL
        return embedUrl;
      } catch {
        return embedUrl;
      }
    };
    
    // Collect server data-urls first
    const serverEntries: { name: string; dataUrl: string }[] = [];
    $('.server-btn, button[data-url], .server-item').each((_, el) => {
      const $el = $(el);
      const dataUrl = $el.attr('data-url') || '';
      const serverName = $el.text().trim();
      if (dataUrl) {
        serverEntries.push({ name: serverName || `Server ${serverEntries.length + 1}`, dataUrl });
      }
    });

    // If no server buttons, fall back to iframe
    if (serverEntries.length === 0) {
      $('iframe').each((_, el) => {
        const src = $(el).attr('src') || '';
        if (src && !src.includes('facebook') && !src.includes('twitter') && !src.includes('ads')) {
          serverEntries.push({ name: 'HD-1', dataUrl: src });
        }
      });
    }

    // For each server entry, extract the real video URL
    for (const entry of serverEntries) {
      let finalUrl = entry.dataUrl;
      // If the URL is from a wrapper domain, extract the real video URL inside
      if (entry.dataUrl.includes('subcrp.site') || entry.dataUrl.includes('player.php')) {
        finalUrl = await extractRealVideoUrl(entry.dataUrl);
      }
      
      servers.push({
        name: entry.name,
        url: finalUrl,
        quality: entry.name.toLowerCase().includes('720') ? '720p' : 
                 entry.name.toLowerCase().includes('1080') ? '1080p' : 'HD',
      });
    }

    // Navigation - prev/next episode
    const prevHref = $('a[title*="Sebelumnya"], a[title*="Previous"]').attr('href') || '';
    const nextHref = $('a[title*="Selanjutnya"], a[title*="Next"]').attr('href') || '';
    
    const prevEpisode = prevHref ? prevHref.split('/').filter(Boolean).pop() : undefined;
    const nextEpisode = nextHref ? nextHref.split('/').filter(Boolean).pop() : undefined;

    const detail: EpisodeDetail = {
      title: fullTitle || `${animeTitle} Episode ${episodeNumber}`,
      animeTitle,
      episodeNumber,
      servers,
      prevEpisode,
      nextEpisode,
    };

    await setCache(cacheKey, detail);
    return detail;
  } catch (error) {
    console.error('Error fetching episode detail from subnime:', error);
    return null;
  }
}

/**
 * Get anime by genre
 */
export async function getAnimeByGenre(genre: string, page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `subnime:genre:${genre}:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/search?genre=${encodeURIComponent(genre)}&page=${page}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    $('.anime-card').each((_, el) => {
      const $el = $(el);
      
      let href = '';
      let title = '';
      const cardTitleLink = $el.find('.card-title a');
      if (cardTitleLink.length) {
        href = cardTitleLink.attr('href') || '';
        title = cardTitleLink.text().trim();
      } else if ($el.is('a')) {
        href = $el.attr('href') || '';
        title = $el.find('.anime-title').text().trim() || $el.attr('title') || '';
      } else {
        const anyLink = $el.find('a[href*="/anime/"]').first();
        href = anyLink.attr('href') || '';
        title = anyLink.text().trim() || $el.find('h3').text().trim();
      }
      
      if (!href.includes('/anime/')) return;
      
      const slugMatch = href.match(/\/anime\/([^/]+)/);
      if (!slugMatch) return;
      const slug = slugMatch[1];
      
      if (seen.has(slug)) return;
      seen.add(slug);
      
      title = title.replace(/\s+/g, ' ').trim().substring(0, 150);
      if (!title || title.length < 2) return;
      
      const poster = $el.find('.card-poster img, img.anime-poster, img').first().attr('src') ||
                     $el.find('img').attr('data-src') || '';

      animeList.push({
        id: `subnime-${slug}`,
        title,
        slug: `subnime-${slug}`,
        poster: poster.startsWith('http') ? poster : poster ? `${BASE_URL}${poster}` : '',
        url: `${BASE_URL}/anime/${slug}`,
        source: 'subnime',
      });
    });

    const hasNext = $('a[rel="next"], .pagination .next').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching anime by genre from subnime:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get latest anime (for completeness, though mainly used for search)
 */
export async function getLatestAnime(page: number = 1): Promise<{ data: AnimeItem[]; hasNext: boolean }> {
  const cacheKey = `subnime:latest:${page}`;
  const cached = await getCached<{ data: AnimeItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    const animeList: AnimeItem[] = [];
    const seen = new Set<string>();

    $('.anime-card').each((_, el) => {
      const $el = $(el);
      
      let href = '';
      let title = '';
      if ($el.is('a')) {
        href = $el.attr('href') || '';
        title = $el.find('.anime-title').text().trim() || $el.attr('title') || '';
      } else {
        const cardTitleLink = $el.find('.card-title a');
        if (cardTitleLink.length) {
          href = cardTitleLink.attr('href') || '';
          title = cardTitleLink.text().trim();
        } else {
          const anyLink = $el.find('a[href*="/anime/"]').first();
          href = anyLink.attr('href') || '';
          title = anyLink.text().trim() || $el.find('h3').text().trim();
        }
      }
      
      if (!href.includes('/anime/')) return;
      
      const slugMatch = href.match(/\/anime\/([^/]+)/);
      if (!slugMatch) return;
      const slug = slugMatch[1];
      
      if (seen.has(slug)) return;
      seen.add(slug);
      
      title = title.replace(/\s+/g, ' ').trim().substring(0, 150);
      if (!title || title.length < 2) return;
      
      const poster = $el.find('.card-poster img, img.anime-poster, img').first().attr('src') ||
                     $el.find('img').attr('data-src') || '';
      const latestEpisode = $el.find('.episode-badge').text().trim() || '';

      animeList.push({
        id: `subnime-${slug}`,
        title,
        slug: `subnime-${slug}`,
        poster: poster.startsWith('http') ? poster : poster ? `${BASE_URL}${poster}` : '',
        latestEpisode: latestEpisode || undefined,
        url: `${BASE_URL}/anime/${slug}`,
        source: 'subnime',
      });
    });

    const hasNext = $('a[rel="next"], .pagination .next').length > 0;
    const result = { data: animeList, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching latest anime from subnime:', error);
    return { data: [], hasNext: false };
  }
}

export default {
  searchAnime,
  getAnimeDetail,
  getEpisodeDetail,
  getAnimeByGenre,
  getLatestAnime,
};
