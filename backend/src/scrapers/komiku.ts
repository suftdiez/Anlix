/**
 * Komiku Scraper - Fast version using Cheerio
 * Scrapes comic data from komiku.cc
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://komiku.org';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

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

export interface Comic {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type?: string;
  latestChapter?: string;
  updatedAt?: string;
  url: string;
}

export interface ComicDetail {
  id: string;
  title: string;
  slug: string;
  poster: string;
  type: string;
  author: string;
  released: string;
  synopsis: string;
  genres: string[];
  chapters: Chapter[];
  url: string;
}

export interface Chapter {
  number: string;
  title: string;
  slug: string;
  url: string;
  updatedAt: string;
}

export interface ChapterImages {
  title: string;
  comicSlug: string;
  comicTitle: string;
  comicPoster: string;  // Added for reading history display
  chapterNumber: string;
  images: string[];
  prevChapter?: string;
  nextChapter?: string;
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
  
  if (memoryCache.size > 100) {
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, 20);
    keysToDelete.forEach(k => memoryCache.delete(k));
  }
}

/**
 * Get latest/updated comics from homepage
 */
export async function getLatest(): Promise<Comic[]> {
  const cacheKey = 'komiku:latest';
  const cached = await getCached<Comic[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data: html } = await axiosInstance.get(BASE_URL);
    const $ = cheerio.load(html);
    
    const comics: Comic[] = [];
    const seen = new Set<string>();
    
    // Find comic links on homepage
    $('a[href*="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      // Skip chapter links
      if (href.includes('-chapter-')) return;
      
      // Extract slug
      const match = href.match(/\/manga\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      // Get title from h3 or title attribute
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      
      // Get poster image
      const img = $el.find('img').first();
      const poster = img.attr('data-src') || img.attr('src') || '';
      
      // Get chapter and time info from spans
      const spans = $el.find('span');
      let latestChapter = '';
      let updatedAt = '';
      
      spans.each((_, span) => {
        const text = $(span).text().trim();
        if (text.toLowerCase().includes('chapter') || /^\d+$/.test(text)) {
          latestChapter = text;
        } else if (text.includes('jam') || text.includes('hari') || text.includes('menit')) {
          updatedAt = text;
        }
      });
      
      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          latestChapter,
          updatedAt,
          url: `${BASE_URL}/manga/${slug}`,
        });
      }
    });
    
    const result = comics.slice(0, 24);
    if (result.length > 0) {
      await setCache(cacheKey, result);
    }
    
    console.log(`[Komiku] Found ${result.length} latest comics`);
    return result;
  } catch (error) {
    console.error('[Komiku] Error fetching latest:', error);
    return [];
  }
}

/**
 * Get all comics list with pagination
 */
export async function getList(page: number = 1): Promise<{ comics: Comic[]; hasNext: boolean }> {
  const cacheKey = `komiku:list:${page}`;
  const cached = await getCached<{ comics: Comic[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 ? `${BASE_URL}/list` : `${BASE_URL}/list/page/${page}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);
    
    const comics: Comic[] = [];
    const seen = new Set<string>();
    
    $('a[href*="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      if (href.includes('-chapter-')) return;
      
      const match = href.match(/\/manga\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('data-src') || img.attr('src') || '';
      
      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          url: `${BASE_URL}/manga/${slug}`,
        });
      }
    });
    
    const hasNext = $('a:contains("NEXT"), a:contains("Next"), .next, a[rel="next"]').length > 0;
    const result = { comics, hasNext };
    
    if (comics.length > 0) {
      await setCache(cacheKey, result);
    }
    
    console.log(`[Komiku] Found ${comics.length} comics on list page ${page}`);
    return result;
  } catch (error) {
    console.error('[Komiku] Error fetching list:', error);
    return { comics: [], hasNext: false };
  }
}

/**
 * Get comics by type (manga, manhwa, manhua)
 */
export async function getByType(
  type: 'manga' | 'manhwa' | 'manhua',
  page: number = 1
): Promise<{ comics: Comic[]; hasNext: boolean }> {
  const cacheKey = `komiku:${type}:${page}`;
  const cached = await getCached<{ comics: Comic[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 ? `${BASE_URL}/${type}` : `${BASE_URL}/${type}/page/${page}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);
    
    const comics: Comic[] = [];
    const seen = new Set<string>();
    
    $('a[href*="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      if (href.includes('-chapter-')) return;
      
      const match = href.match(/\/manga\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('data-src') || img.attr('src') || '';
      
      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          type: type.charAt(0).toUpperCase() + type.slice(1),
          url: `${BASE_URL}/manga/${slug}`,
        });
      }
    });
    
    const hasNext = $('a:contains("NEXT"), a:contains("Next"), .next, a[rel="next"]').length > 0;
    const result = { comics, hasNext };
    
    if (comics.length > 0) {
      await setCache(cacheKey, result);
    }
    
    console.log(`[Komiku] Found ${comics.length} ${type} comics on page ${page}`);
    return result;
  } catch (error) {
    console.error(`[Komiku] Error fetching ${type}:`, error);
    return { comics: [], hasNext: false };
  }
}

/**
 * Get comic detail with chapters (pure axios+cheerio, no Puppeteer needed)
 * All chapters are rendered in static HTML on komiku.cc
 */
export async function getDetail(slug: string): Promise<ComicDetail | null> {
  const cacheKey = `komiku:detail:${slug}`;
  const cached = await getCached<ComicDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/manga/${slug}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    // Get title
    const title = $('h1').first().text().trim() ||
                  slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Get poster
    const poster = $('img[src*="komiku"], img[alt*="komik"]').first().attr('src') || '';

    // Get type (Manga/Manhwa/Manhua)
    let type = 'Manga';
    $('span').each((_, el) => {
      const text = $(el).text().trim();
      // Check "Type: Manhwa" combined format
      if (text.toLowerCase().startsWith('type:')) {
        const typeMatch = text.match(/type:\s*(manga|manhwa|manhua)/i);
        if (typeMatch) {
          type = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase();
          return false; // break
        }
      }
      // Check separate "Type:" label with sibling value
      if (text.toLowerCase() === 'type:' || text.toLowerCase() === 'type') {
        const nextText = $(el).next('span').text().trim();
        if (nextText.match(/^(manga|manhwa|manhua)$/i)) {
          type = nextText.charAt(0).toUpperCase() + nextText.slice(1).toLowerCase();
          return false; // break
        }
      }
    });

    // Get author
    let author = '';
    $('span').each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes('author:') || text.toLowerCase() === 'author') {
        const nextText = $(el).next('span').text().trim() || $(el).next().text().trim();
        if (nextText) {
          author = nextText;
        } else {
          author = text.replace(/author:?/i, '').trim();
        }
        return false; // break
      }
    });

    // Get released year
    let released = '';
    $('span').each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes('rilis:') || text.toLowerCase() === 'rilis') {
        const nextText = $(el).next('span').text().trim() || $(el).next().text().trim();
        const yearMatch = (nextText || text).match(/\d{4}/);
        if (yearMatch) released = yearMatch[0];
        return false; // break
      }
    });

    // Get genres
    const genres: string[] = [];
    $('a[href*="/genre/"]').each((_, el) => {
      const genre = $(el).text().trim();
      if (genre && !genres.includes(genre)) {
        genres.push(genre);
      }
    });

    // Get synopsis (longest paragraph)
    let synopsis = '';
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 100 && !synopsis) {
        synopsis = text;
      }
    });

    // Get chapters — all are in static HTML (hidden ones are toggled by JS)
    const chapters: Chapter[] = [];
    const seen = new Set<string>();

    $('a[href*="-chapter-"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const text = $el.text().trim().toLowerCase();

      // Skip "Chapter Awal" or navigation buttons
      if (text.includes('awal') || text.includes('pertama') || text.includes('first')) return;

      // Skip button-like parents
      const parentClass = $el.parent().attr('class') || '';
      if (parentClass.includes('btn') || parentClass.includes('button')) return;

      // Normalize href to full URL
      const fullHref = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

      if (seen.has(fullHref)) return;
      seen.add(fullHref);

      // Extract chapter number from URL
      const numMatch = fullHref.match(/-chapter-(\d+(?:\.\d+)?)/i);
      const chapterNum = numMatch ? numMatch[1] : '';
      if (!chapterNum) return;

      const chapterSlug = fullHref.split('/').filter(Boolean).pop() || '';

      // Extract update time from spans inside the link
      let updatedAt = '';
      $el.find('span').each((_, span) => {
        const spanText = $(span).text().trim();
        const timeMatch = spanText.match(/^(\d+)\s*(menit|jam|hari|bulan|tahun)$/i);
        if (timeMatch) {
          updatedAt = `${timeMatch[1]} ${timeMatch[2]}`;
        }
      });

      // If no span found, check the text content for time patterns
      if (!updatedAt) {
        const timeMatch = $el.text().trim().match(/(\d+)\s*(menit|jam|hari|bulan|tahun)/i);
        if (timeMatch) {
          updatedAt = `${timeMatch[1]} ${timeMatch[2]}`;
        }
      }

      chapters.push({
        number: chapterNum,
        title: `Chapter ${chapterNum}`,
        slug: chapterSlug,
        url: fullHref,
        updatedAt,
      });
    });

    // Sort chapters by number (descending)
    chapters.sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

    const result: ComicDetail = {
      id: slug,
      title,
      slug,
      poster,
      type,
      author,
      released,
      synopsis: synopsis || 'Tidak ada sinopsis.',
      genres,
      chapters,
      url: `${BASE_URL}/manga/${slug}`,
    };

    if (title) {
      await setCache(cacheKey, result);
    }

    console.log(`[Komiku] Got detail for ${slug}: ${chapters.length} chapters`);
    return result;
  } catch (error) {
    console.error('[Komiku] Error fetching detail:', error);
    return null;
  }
}

/**
 * Get chapter images for reading
 */
export async function getChapterImages(chapterSlug: string): Promise<ChapterImages | null> {
  const cacheKey = `komiku:chapter:${chapterSlug}`;
  const cached = await getCached<ChapterImages>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/${chapterSlug}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);
    
    // Get chapter title
    const title = $('h1').first().text().trim() || chapterSlug;
    
    // Extract comic slug, title and chapter number
    const titleMatch = title.match(/(.+?)\s*[-–]\s*Chapter\s*(\d+(?:\.\d+)?)/i) ||
                       chapterSlug.match(/(.+?)-chapter-(\d+(?:\.\d+)?)/i);
    const comicTitle = titleMatch ? titleMatch[1].replace(/-/g, ' ').trim() : '';
    const comicSlug = titleMatch ? titleMatch[1].replace(/\s+/g, '-').toLowerCase() : chapterSlug.replace(/-chapter-.*/, '');
    const chapterNumber = titleMatch ? titleMatch[2] : '';
    
    // Get chapter images
    const images: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      // Filter for chapter images (usually contain certain patterns)
      if (src && (src.includes('img') || src.includes('chapter') || src.includes('komiku')) 
          && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
        // Check if it looks like a manga page (not a small icon)
        const width = $(el).attr('width');
        const height = $(el).attr('height');
        if (width && parseInt(width) < 100) return;
        if (height && parseInt(height) < 100) return;
        
        if (!images.includes(src)) {
          images.push(src);
        }
      }
    });
    
    // Alternative: look for images in specific containers
    if (images.length === 0) {
      $('[id*="readerarea"] img, .chapter-content img, .reading-content img, #chapter-content img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src && !images.includes(src)) {
          images.push(src);
        }
      });
    }
    
    // Get navigation links
    const prevChapter = $('a[href*="-chapter-"]:contains("Prev"), a[rel="prev"]').first().attr('href')?.split('/').pop();
    const nextChapter = $('a[href*="-chapter-"]:contains("Next"), a[rel="next"]').first().attr('href')?.split('/').pop();
    
    // Try to get comic poster from cached detail
    let comicPoster = '';
    const detailCacheKey = `komiku:detail:${comicSlug}`;
    const cachedDetail = await getCached<ComicDetail>(detailCacheKey);
    if (cachedDetail?.poster) {
      comicPoster = cachedDetail.poster;
    } else {
      // Fallback: try to get og:image from the chapter page
      const ogImage = $('meta[property="og:image"]').attr('content') || '';
      if (ogImage && !ogImage.includes('logo') && !ogImage.includes('icon')) {
        comicPoster = ogImage;
      }
    }
    
    const result: ChapterImages = {
      title,
      comicSlug,
      comicTitle,
      comicPoster,
      chapterNumber,
      images,
      prevChapter,
      nextChapter,
    };
    
    if (images.length > 0) {
      await setCache(cacheKey, result);
    }
    
    console.log(`[Komiku] Got ${images.length} images for chapter ${chapterSlug}`);
    return result;
  } catch (error) {
    console.error('[Komiku] Error fetching chapter images:', error);
    return null;
  }
}

/**
 * Search comics by query
 */
export async function search(query: string): Promise<Comic[]> {
  const cacheKey = `komiku:search:${query}`;
  const cached = await getCached<Comic[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);
    
    const comics: Comic[] = [];
    const seen = new Set<string>();
    
    $('a[href*="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      if (href.includes('-chapter-')) return;
      
      const match = href.match(/\/manga\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('data-src') || img.attr('src') || '';
      
      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          url: `${BASE_URL}/manga/${slug}`,
        });
      }
    });
    
    if (comics.length > 0) {
      await setCache(cacheKey, comics);
    }
    
    console.log(`[Komiku] Found ${comics.length} comics for search "${query}"`);
    return comics;
  } catch (error) {
    console.error('[Komiku] Error searching:', error);
    return [];
  }
}

// Predefined genres based on common manga/manhwa/manhua genres
export const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
  'Horror', 'Isekai', 'Martial Arts', 'Mystery', 'Psychological',
  'Romance', 'Sci-Fi', 'Shoujo', 'Shounen', 'Slice of Life',
  'Sports', 'Supernatural', 'Tragedy', 'Harem', 'School Life',
  'Ecchi', 'Mecha', 'Historical', 'Military', 'Music',
  'Demons', 'Magic', 'Vampire', 'Josei', 'Seinen'
];

/**
 * Get all available genres
 */
export function getGenres(): string[] {
  return [...GENRES].sort();
}

/**
 * Get comics by genre (uses search to find comics with genre in title/description)
 */
export async function getByGenre(genre: string, page: number = 1): Promise<{ comics: Comic[]; hasNext: boolean }> {
  const cacheKey = `komiku:genre:${genre}:${page}`;
  const cached = await getCached<{ comics: Comic[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Use search API to find comics (genre matching will be approximate)
    const url = `${BASE_URL}/search?q=${encodeURIComponent(genre)}${page > 1 ? `&page=${page}` : ''}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const comics: Comic[] = [];
    const seen = new Set<string>();

    $('a[href*="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';

      if (href.includes('-chapter-')) return;

      const match = href.match(/\/manga\/([^\/]+)/);
      const slug = match ? match[1] : '';

      if (!slug || seen.has(slug)) return;
      seen.add(slug);

      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('data-src') || img.attr('src') || '';

      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          url: `${BASE_URL}/manga/${slug}`,
        });
      }
    });

    // Check for next page
    const hasNext = $('a[href*="page="]').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return href.includes(`page=${page + 1}`);
    }).length > 0;

    const result = { comics, hasNext };
    
    if (comics.length > 0) {
      await setCache(cacheKey, result);
    }

    console.log(`[Komiku] Found ${comics.length} comics for genre "${genre}" page ${page}`);
    return result;
  } catch (error) {
    console.error('[Komiku] Error fetching by genre:', error);
    return { comics: [], hasNext: false };
  }
}

/**
 * Get comics by author (uses search to find comics by author name)
 */
export async function getByAuthor(author: string, page: number = 1): Promise<{ comics: Comic[]; hasNext: boolean }> {
  const cacheKey = `komiku:author:${author}:${page}`;
  const cached = await getCached<{ comics: Comic[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Use search API to find comics by author name
    const url = `${BASE_URL}/search?q=${encodeURIComponent(author)}${page > 1 ? `&page=${page}` : ''}`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const comics: Comic[] = [];
    const seen = new Set<string>();

    $('a[href*="/manga/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';

      if (href.includes('-chapter-')) return;

      const match = href.match(/\/manga\/([^\/]+)/);
      const slug = match ? match[1] : '';

      if (!slug || seen.has(slug)) return;
      seen.add(slug);

      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('data-src') || img.attr('src') || '';

      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          url: `${BASE_URL}/manga/${slug}`,
        });
      }
    });

    // Check for next page
    const hasNext = $('a[href*="page="]').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return href.includes(`page=${page + 1}`);
    }).length > 0;

    const result = { comics, hasNext };
    
    if (comics.length > 0) {
      await setCache(cacheKey, result);
    }

    console.log(`[Komiku] Found ${comics.length} comics for author "${author}" page ${page}`);
    return result;
  } catch (error) {
    console.error('[Komiku] Error fetching by author:', error);
    return { comics: [], hasNext: false };
  }
}

export default {
  getLatest,
  getList,
  getByType,
  getDetail,
  getChapterImages,
  search,
  getGenres,
  getByGenre,
  getByAuthor,
  GENRES,
};

