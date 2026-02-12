import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://kusonime.com';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1500;

// Axios instance
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

// ============================================
// INTERFACES
// ============================================

export interface DownloadLink {
  host: string;   // e.g. "Justpaste", "Terabox", "Google Drive"
  url: string;
}

export interface DownloadBlock {
  title: string;     // e.g. "Download Episode 01-06" or quality label
  quality: string;   // e.g. "480p", "720p", "Allreso"
  links: DownloadLink[];
}

export interface BatchDownloadResult {
  title: string;
  poster?: string;
  genres?: string[];
  status?: string;
  type?: string;
  score?: string;
  totalEpisodes?: string;
  season?: string;
  downloads: DownloadBlock[];
}

// ============================================
// CACHE HELPERS
// ============================================

async function getCached<T>(key: string): Promise<T | null> {
  try {
    if (redis) {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached);
    }
  } catch {
    // Redis error, try memory cache
  }

  const memCached = memoryCache.get(key);
  if (memCached && memCached.expiry > Date.now()) {
    return JSON.parse(memCached.data);
  }
  return null;
}

async function setCache(key: string, data: unknown): Promise<void> {
  const jsonData = JSON.stringify(data);
  try {
    if (redis) {
      await redis.set(key, jsonData, CACHE_TTL);
    }
  } catch {
    // Redis error, use memory
  }
  memoryCache.set(key, {
    data: jsonData,
    expiry: Date.now() + CACHE_TTL * 1000,
  });
}

// ============================================
// SCRAPER FUNCTIONS
// ============================================

/**
 * Search anime on Kusonime
 */
export async function searchAnime(query: string): Promise<{ title: string; slug: string; url: string; poster?: string }[]> {
  const cacheKey = `kusonime:search:${query}`;
  const cached = await getCached<{ title: string; slug: string; url: string; poster?: string }[]>(cacheKey);
  if (cached) return cached;

  try {
    const html = await throttledRequest(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=post`);
    const $ = cheerio.load(html);
    const results: { title: string; slug: string; url: string; poster?: string }[] = [];

    // Kusonime search results use .kover containers
    $('.kover').each((_, el) => {
      const linkEl = $(el).find('.episodeye a, h2 a').first();
      const imgEl = $(el).find('.thumb img, img').first();
      const url = linkEl.attr('href') || '';
      const title = linkEl.text().trim() || imgEl.attr('alt') || '';
      const poster = imgEl.attr('src') || imgEl.attr('data-src') || '';

      if (url && title) {
        // Extract slug from URL: https://kusonime.com/slug/ -> slug
        const urlParts = url.replace(/^https?:\/\/kusonime\.com\//, '').replace(/\/$/, '');
        results.push({
          title: title.replace(/Subtitle Indonesia/gi, '').replace(/Batch/gi, '').replace(/BD\s*/gi, '').trim(),
          slug: urlParts,
          url,
          poster,
        });
      }
    });

    // Fallback: try h2 > a links if .kover not found
    if (results.length === 0) {
      $('h2.episodeye a, .venser h2 a').each((_, el) => {
        const url = $(el).attr('href') || '';
        const title = $(el).text().trim();

        if (url && title && url.includes('kusonime.com')) {
          const urlParts = url.replace(/^https?:\/\/kusonime\.com\//, '').replace(/\/$/, '');
          results.push({
            title: title.replace(/Subtitle Indonesia/gi, '').replace(/Batch/gi, '').replace(/BD\s*/gi, '').trim(),
            slug: urlParts,
            url,
          });
        }
      });
    }

    await setCache(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Kusonime search error:', error);
    return [];
  }
}

/**
 * Get batch download links from a Kusonime detail page
 */
export async function getBatchDownloads(slug: string): Promise<BatchDownloadResult | null> {
  const cacheKey = `kusonime:batch:${slug}`;
  const cached = await getCached<BatchDownloadResult>(cacheKey);
  if (cached) return cached;

  try {
    // Ensure slug has trailing slash for kusonime
    const url = `${BASE_URL}/${slug}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    // Extract title — try specific selectors first, then generic
    const cleanTitle = (raw: string) => raw
      .replace(/Subtitle Indonesia/gi, '')
      .replace(/Batch/gi, '')
      .replace(/BD\s*/gi, '')
      .replace(/\s*\|.*$/, '')
      .trim();

    let title = cleanTitle($('h1.jdlz').text());
    if (!title) title = cleanTitle($('.entry-title').text());
    if (!title) title = cleanTitle($('title').text());
    if (!title) title = slug.replace(/-/g, ' ').replace(/subtitle indonesia/gi, '').trim();

    // Extract poster
    const poster = $('.post-thumb img, .thumbz img, article img').first().attr('src') || 
                   $('.post-thumb img, .thumbz img, article img').first().attr('data-src') || '';

    // Extract info from <p><b>Label</b>: Value</p> format
    let genres: string[] = [];
    let status = '';
    let type = '';
    let score = '';
    let totalEpisodes = '';
    let season = '';

    $('.info p, .lexot p, .entry-content p').each((_, el) => {
      const text = $(el).text().trim();
      const bold = $(el).find('b, strong').text().trim().toLowerCase();
      const value = text.replace($(el).find('b, strong').text(), '').replace(/^[\s:]+/, '').trim();

      if (bold.includes('genre')) {
        genres = $(el).find('a').map((_, a) => $(a).text().trim()).get();
      } else if (bold.includes('status')) {
        status = value;
      } else if (bold.includes('type')) {
        type = value;
      } else if (bold.includes('score')) {
        score = value;
      } else if (bold.includes('total episode')) {
        totalEpisodes = value;
      } else if (bold.includes('season')) {
        season = $(el).find('a').text().trim() || value;
      }
    });

    // Extract download links
    const downloads: DownloadBlock[] = [];

    // Pattern 1: smokeddlrh blocks (newer kusonime format)
    $('.smokeddlrh').each((_, block) => {
      const blockTitle = $(block).find('.smokettlrh').text().trim();
      
      $(block).find('.smokeurlrh').each((_, urlBlock) => {
        const quality = $(urlBlock).find('strong').text().trim() || 'Unknown';
        const links: DownloadLink[] = [];

        $(urlBlock).find('a').each((_, link) => {
          const href = $(link).attr('href');
          const host = $(link).text().trim();
          if (href && host && !href.includes('facebook.com') && !href.includes('twitter.com') && !href.includes('plus.google.com')) {
            links.push({ host, url: href });
          }
        });

        if (links.length > 0) {
          downloads.push({
            title: blockTitle || title,
            quality,
            links,
          });
        }
      });
    });

    // Pattern 2: smokeurl blocks (older format)
    if (downloads.length === 0) {
      $('.smokeurl').each((_, block) => {
        const quality = $(block).find('strong').text().trim() || 'Unknown';
        const links: DownloadLink[] = [];

        $(block).find('a').each((_, link) => {
          const href = $(link).attr('href');
          const host = $(link).text().trim();
          if (href && host && !href.includes('facebook.com') && !href.includes('twitter.com') && !href.includes('plus.google.com')) {
            links.push({ host, url: href });
          }
        });

        if (links.length > 0) {
          downloads.push({
            title,
            quality,
            links,
          });
        }
      });
    }

    // Pattern 3: dlbod or dlbox blocks
    if (downloads.length === 0) {
      $('.dlbod, .dlbox').each((_, block) => {
        const blockTitle = $(block).find('h4, .dlbodhd').text().trim();
        
        $(block).find('.dlbodz a, a').each((_, link) => {
          const href = $(link).attr('href');
          const host = $(link).text().trim();
          if (href && host && host.length < 50 && !href.includes('facebook.com') && !href.includes('twitter.com')) {
            downloads.push({
              title: blockTitle || title,
              quality: 'Unknown',
              links: [{ host, url: href }],
            });
          }
        });
      });
    }

    if (downloads.length === 0) return null;

    const result: BatchDownloadResult = {
      title,
      poster,
      genres,
      status,
      type,
      score,
      totalEpisodes,
      season,
      downloads,
    };

    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Kusonime getBatchDownloads error:', error);
    return null;
  }
}

/**
 * Search kusonime by anime title and return batch downloads
 * This is the main function used by the frontend
 */
export async function findBatchDownloads(animeTitle: string): Promise<BatchDownloadResult | null> {
  const cacheKey = `kusonime:find:${animeTitle}`;
  const cached = await getCached<BatchDownloadResult>(cacheKey);
  if (cached) return cached;

  try {
    // Search by title
    const results = await searchAnime(animeTitle);
    
    if (results.length === 0) return null;

    // Try the first matching result
    for (const result of results.slice(0, 3)) {
      const downloads = await getBatchDownloads(result.slug);
      if (downloads && downloads.downloads.length > 0) {
        await setCache(cacheKey, downloads);
        return downloads;
      }
    }

    return null;
  } catch (error) {
    console.error('Kusonime findBatchDownloads error:', error);
    return null;
  }
}

export default {
  searchAnime,
  getBatchDownloads,
  findBatchDownloads,
};
