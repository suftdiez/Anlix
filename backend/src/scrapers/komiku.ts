/**
 * Komiku Scraper - Fast version using Cheerio
 * Scrapes comic data from komiku.cc
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://komiku.cc';
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
  comicTitle: string;
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
    $('a[href*="/komik/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      // Skip chapter links
      if (href.includes('-chapter-')) return;
      
      // Extract slug
      const match = href.match(/\/komik\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      // Get title from h3 or title attribute
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      
      // Get poster image
      const img = $el.find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      
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
          url: `${BASE_URL}/komik/${slug}`,
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
    
    $('a[href*="/komik/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      if (href.includes('-chapter-')) return;
      
      const match = href.match(/\/komik\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      
      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          url: `${BASE_URL}/komik/${slug}`,
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
    
    $('a[href*="/komik/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      if (href.includes('-chapter-')) return;
      
      const match = href.match(/\/komik\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      
      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          type: type.charAt(0).toUpperCase() + type.slice(1),
          url: `${BASE_URL}/komik/${slug}`,
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
 * Get comic detail with chapters (uses Puppeteer to handle "Load More" button)
 */
export async function getDetail(slug: string): Promise<ComicDetail | null> {
  const cacheKey = `komiku:detail:${slug}`;
  const cached = await getCached<ComicDetail>(cacheKey);
  if (cached) return cached;

  let browser;
  try {
    const puppeteer = await import('puppeteer');
    
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const url = `${BASE_URL}/komik/${slug}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    
    // Try to click "Load More" / "Tampilkan Lebih Banyak" button multiple times to load all chapters
    // Need 150+ clicks for comics with 1000+ chapters like One Piece
    for (let i = 0; i < 150; i++) {
      try {
        // Use page.evaluate to find and click load more button
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase();
            if (text.includes('tampilkan') || text.includes('lebih') || text.includes('load') || text.includes('more')) {
              (btn as HTMLButtonElement).click();
              return true;
            }
          }
          return false;
        });
        if (!clicked) break;
        // Shorter delay for faster loading
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch {
        break;
      }
    }
    
    // Wait a moment for chapters to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Extract data from page
    const data = await page.evaluate((baseUrl, comicSlug) => {
      // Get title
      const title = document.querySelector('h1')?.textContent?.trim() || 
                    comicSlug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      // Get poster
      const posterEl = document.querySelector('img[src*="komiku"], img[alt*="komik"]');
      const poster = posterEl?.getAttribute('src') || '';
      
      // Get type - look for "Type:" label and get sibling value span
      let type = 'Manga';
      let typeFound = false;
      const allSpans = document.querySelectorAll('span');
      allSpans.forEach(span => {
        if (typeFound) return; // Already found
        const text = span.textContent?.trim() || '';
        // Check for exact "Type:" pattern (case insensitive)
        if (text.toLowerCase() === 'type:' || text.toLowerCase() === 'type') {
          // Get the value from next sibling span
          const nextSibling = span.nextElementSibling;
          if (nextSibling && nextSibling.tagName === 'SPAN') {
            const siblingText = nextSibling.textContent?.trim() || '';
            if (siblingText.match(/^(manga|manhwa|manhua)$/i)) {
              type = siblingText.charAt(0).toUpperCase() + siblingText.slice(1).toLowerCase();
              typeFound = true;
            }
          }
        }
        // Also check for combined format "Type: Manga"
        if (!typeFound && text.toLowerCase().startsWith('type:')) {
          const typeMatch = text.match(/type:\s*(manga|manhwa|manhua)/i);
          if (typeMatch) {
            type = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase();
            typeFound = true;
          }
        }
      });
      
      // Get author - look for "Author:" pattern
      let author = '';
      allSpans.forEach(span => {
        const text = span.textContent?.trim() || '';
        if (text.toLowerCase().includes('author:') || text.toLowerCase() === 'author') {
          const nextSibling = span.nextElementSibling;
          if (nextSibling) {
            author = nextSibling.textContent?.trim() || '';
          } else {
            author = text.replace(/author:?/i, '').trim();
          }
        }
      });
      
      // Get released year - look for "Rilis:" pattern
      let released = '';
      allSpans.forEach(span => {
        const text = span.textContent?.trim() || '';
        if (text.toLowerCase().includes('rilis:') || text.toLowerCase() === 'rilis') {
          const nextSibling = span.nextElementSibling;
          if (nextSibling) {
            const yearMatch = nextSibling.textContent?.match(/\d{4}/);
            released = yearMatch ? yearMatch[0] : '';
          } else {
            const yearMatch = text.match(/\d{4}/);
            released = yearMatch ? yearMatch[0] : '';
          }
        }
      });
      
      // Get genres
      const genres: string[] = [];
      document.querySelectorAll('a[href*="/genre/"]').forEach(el => {
        const genre = el.textContent?.trim();
        if (genre && !genres.includes(genre)) {
          genres.push(genre);
        }
      });
      
      // Get synopsis
      let synopsis = '';
      document.querySelectorAll('p').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length > 100 && !synopsis) {
          synopsis = text;
        }
      });
      
      // Get chapters
      const chapters: any[] = [];
      const seen = new Set<string>();
      
      document.querySelectorAll('a[href*="-chapter-"]').forEach(el => {
        const link = el as HTMLAnchorElement;
        const href = link.href;
        const text = link.textContent?.trim().toLowerCase() || '';
        
        // Skip "Chapter Awal" or navigation buttons
        if (text.includes('awal') || text.includes('pertama') || text.includes('first')) return;
        
        // Skip button-like parents
        const parentClass = link.parentElement?.className || '';
        if (parentClass.includes('btn') || parentClass.includes('button')) return;
        
        if (seen.has(href)) return;
        seen.add(href);
        
        // Extract chapter number from URL
        const numMatch = href.match(/-chapter-(\d+(?:\.\d+)?)/i);
        const chapterNum = numMatch ? numMatch[1] : '';
        
        if (!chapterNum) return;
        
        const chapterSlug = href.split('/').filter(Boolean).pop() || '';
        
        // Extract update time
        const chapterText = link.textContent?.trim() || '';
        const timeMatch = chapterText.match(/(\d+)\s*(menit|jam|hari|bulan|tahun)/i);
        const updatedAt = timeMatch ? `${timeMatch[1]} ${timeMatch[2]}` : '';
        
        chapters.push({
          number: chapterNum,
          title: `Chapter ${chapterNum}`,
          slug: chapterSlug,
          url: href,
          updatedAt,
        });
      });
      
      // Sort chapters by number (descending)
      chapters.sort((a, b) => parseFloat(b.number) - parseFloat(a.number));
      
      return {
        id: comicSlug,
        title,
        slug: comicSlug,
        poster,
        type,
        author,
        released,
        synopsis: synopsis || 'Tidak ada sinopsis.',
        genres,
        chapters,
        url: baseUrl + '/komik/' + comicSlug,
      };
    }, BASE_URL, slug);
    
    await browser.close();
    
    if (data.title) {
      await setCache(cacheKey, data);
    }
    
    console.log(`[Komiku] Got detail for ${slug}: ${data.chapters.length} chapters`);
    return data;
  } catch (error) {
    console.error('[Komiku] Error fetching detail:', error);
    if (browser) await browser.close();
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
    
    // Extract comic title and chapter number
    const titleMatch = title.match(/(.+?)\s*[-–]\s*Chapter\s*(\d+(?:\.\d+)?)/i) ||
                       chapterSlug.match(/(.+?)-chapter-(\d+(?:\.\d+)?)/i);
    const comicTitle = titleMatch ? titleMatch[1].replace(/-/g, ' ').trim() : '';
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
    
    const result: ChapterImages = {
      title,
      comicTitle,
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
    
    $('a[href*="/komik/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      if (href.includes('-chapter-')) return;
      
      const match = href.match(/\/komik\/([^\/]+)/);
      const slug = match ? match[1] : '';
      
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      
      const title = $el.find('h3').first().text().trim() || $el.attr('title') || '';
      const img = $el.find('img').first();
      const poster = img.attr('src') || img.attr('data-src') || '';
      
      if (title || poster) {
        comics.push({
          id: slug,
          title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          poster,
          url: `${BASE_URL}/komik/${slug}`,
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

export default {
  getLatest,
  getList,
  getByType,
  getDetail,
  getChapterImages,
  search,
};
