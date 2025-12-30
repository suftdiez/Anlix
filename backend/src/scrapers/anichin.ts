import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://anichin.watch';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

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

// Helper to get cached data
async function getCached<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }
  return null;
}

// Helper to set cache
async function setCache(key: string, data: unknown): Promise<void> {
  await redis.set(key, JSON.stringify(data), CACHE_TTL);
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
    const { data: html } = await axiosInstance.get(url);
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
 * Search donghua by query
 */
export async function searchDonghua(query: string, page: number = 1): Promise<{ data: DonghuaItem[]; hasNext: boolean }> {
  const cacheKey = `anichin:search:${query}:${page}`;
  const cached = await getCached<{ data: DonghuaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
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
    $('.mirror option, select.mirror option, select option').each((_, el) => {
      const value = $(el).attr('value') || '';
      const text = $(el).text().trim();
      
      if (value && value.startsWith('http')) {
        servers.push({
          name: text || 'Server',
          url: value,
          quality: text.includes('720') ? '720p' : text.includes('1080') ? '1080p' : 'HD',
        });
      } else if (value && value.match(/^[A-Za-z0-9+/=]+$/)) {
        try {
          const decoded = Buffer.from(value, 'base64').toString('utf-8');
          if (decoded.startsWith('http')) {
            servers.push({
              name: text || 'Server',
              url: decoded,
              quality: 'HD',
            });
          }
        } catch {
          // Not base64
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
    const url = `${BASE_URL}/genre/${genre}/page/${page}/`;
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

export default {
  getLatestDonghua,
  getOngoingDonghua,
  searchDonghua,
  getDonghuaDetail,
  getEpisodeDetail,
  getDonghuaByGenre,
  getPopularDonghua,
};
