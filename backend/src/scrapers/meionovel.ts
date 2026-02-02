import axios from 'axios';
import * as cheerio from 'cheerio';
import redis from '../config/redis';

const BASE_URL = 'https://meionovels.com';
const CACHE_TTL = parseInt(process.env.SCRAPE_CACHE_TTL || '3600');

// In-memory cache as fallback when Redis is not available
const memoryCache = new Map<string, { data: string; expiry: number }>();

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

// Interfaces
export interface NovelItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  latestChapter?: string;
  type?: string; // HTL or MTL
  updatedAt?: string;
  url: string;
}

export interface NovelDetail extends NovelItem {
  alternativeTitle?: string;
  author?: string;
  genres: string[];
  novelType?: string; // Web Novel Korea/China/Jepang
  tags?: string[];
  release?: string;
  status?: string;
  synopsis: string;
  chapters: Chapter[];
  related?: NovelItem[];
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  slug: string;
  type?: string; // HTL or MTL
  date?: string;
  url: string;
}

export interface ChapterContent {
  title: string;
  novelTitle: string;
  chapterNumber: string;
  content: string;
  prevChapter?: string;
  nextChapter?: string;
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
 * Get latest novels
 */
export async function getLatest(page: number = 1): Promise<{ data: NovelItem[]; hasNext: boolean }> {
  const cacheKey = `meionovel:latest:${page}`;
  const cached = await getCached<{ data: NovelItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 
      ? `${BASE_URL}/novel/` 
      : `${BASE_URL}/novel/page/${page}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const novels: NovelItem[] = [];
    const seen = new Set<string>();

    // Parse novel items from list
    $('.page-item-detail, .manga, article.bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      const title = $el.find('.post-title h3 a, .post-title a, h3 a').first().text().trim() ||
                    linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      
      const latestChapter = $el.find('.chapter-item .chapter a, .list-chapter a').first().text().trim();
      const type = $el.find('.manga-title-badges').text().trim() || ''; // HTL or MTL

      if (href && title) {
        const match = href.match(/\/novel\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        novels.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          latestChapter,
          type: type || 'MTL',
          url: href,
        });
      }
    });

    const hasNext = $('.nav-previous a, .next, a.nextpostslink, .pagination .next').length > 0;
    const result = { data: novels, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[MeioNovel] Error fetching latest:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get popular novels
 */
export async function getPopular(page: number = 1): Promise<{ data: NovelItem[]; hasNext: boolean }> {
  const cacheKey = `meionovel:popular:${page}`;
  const cached = await getCached<{ data: NovelItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 
      ? `${BASE_URL}/novel/?m_orderby=views` 
      : `${BASE_URL}/novel/page/${page}/?m_orderby=views`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const novels: NovelItem[] = [];
    const seen = new Set<string>();

    $('.page-item-detail, .manga, article.bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      const title = $el.find('.post-title h3 a, .post-title a, h3 a').first().text().trim() ||
                    linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      
      const latestChapter = $el.find('.chapter-item .chapter a, .list-chapter a').first().text().trim();

      if (href && title) {
        const match = href.match(/\/novel\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        novels.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          latestChapter,
          url: href,
        });
      }
    });

    const hasNext = $('.nav-previous a, .next, a.nextpostslink').length > 0;
    const result = { data: novels, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[MeioNovel] Error fetching popular:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get novels by category (china, jepang, korea)
 */
export async function getByCategory(category: string, page: number = 1): Promise<{ data: NovelItem[]; hasNext: boolean }> {
  const cacheKey = `meionovel:category:${category}:${page}`;
  const cached = await getCached<{ data: NovelItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    // Map category to URL path
    const categoryMap: Record<string, string> = {
      'china': 'novel-china',
      'jepang': 'novel-jepang',
      'korea': 'novel-korea',
      'tamat': 'tamat',
      'htl': 'htl',
    };
    
    const categoryPath = categoryMap[category.toLowerCase()] || category;
    const url = page === 1 
      ? `${BASE_URL}/novel-tag/${categoryPath}/` 
      : `${BASE_URL}/novel-tag/${categoryPath}/page/${page}/`;
    
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const novels: NovelItem[] = [];
    const seen = new Set<string>();

    $('.page-item-detail, .manga, article.bs, .listupd .bs').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      const title = $el.find('.post-title h3 a, .post-title a, h3 a, .tt').first().text().trim() ||
                    linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';
      
      const latestChapter = $el.find('.chapter-item .chapter a, .list-chapter a').first().text().trim();

      if (href && title) {
        const match = href.match(/\/novel\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        novels.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          latestChapter,
          url: href,
        });
      }
    });

    const hasNext = $('.nav-previous a, .next, a.nextpostslink').length > 0;
    const result = { data: novels, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[MeioNovel] Error fetching by category:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get novels by genre
 */
export async function getByGenre(genre: string, page: number = 1): Promise<{ data: NovelItem[]; hasNext: boolean }> {
  const cacheKey = `meionovel:genre:${genre}:${page}`;
  const cached = await getCached<{ data: NovelItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 
      ? `${BASE_URL}/novel-genre/${genre}/` 
      : `${BASE_URL}/novel-genre/${genre}/page/${page}/`;
    
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const novels: NovelItem[] = [];
    const seen = new Set<string>();

    $('.page-item-detail, .manga').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      const title = $el.find('.post-title h3 a, .post-title a').first().text().trim() ||
                    linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';

      if (href && title) {
        const match = href.match(/\/novel\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        novels.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          url: href,
        });
      }
    });

    const hasNext = $('.nav-previous a, .next').length > 0;
    const result = { data: novels, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[MeioNovel] Error fetching by genre:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get novels by author
 */
export async function getByAuthor(author: string, page: number = 1): Promise<{ data: NovelItem[]; hasNext: boolean; authorName: string }> {
  const cacheKey = `meionovel:author:${author}:${page}`;
  const cached = await getCached<{ data: NovelItem[]; hasNext: boolean; authorName: string }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 
      ? `${BASE_URL}/novel-author/${author}/` 
      : `${BASE_URL}/novel-author/${author}/page/${page}/`;
    
    console.log('[MeioNovel] Fetching author page:', url);
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    // Get author display name from page title or heading
    const authorName = $('.page-header .page-title, h1.page-title, .archive-title').first().text().trim()
      .replace(/^Author:\s*/i, '')
      .replace(/^Novel Author:\s*/i, '') || 
      author.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const novels: NovelItem[] = [];
    const seen = new Set<string>();

    $('.page-item-detail, .manga').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      const title = $el.find('.post-title h3 a, .post-title a').first().text().trim() ||
                    linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';

      const latestChapter = $el.find('.chapter a, .list-chapter a').first().text().trim();

      if (href && title) {
        const match = href.match(/\/novel\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        novels.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          latestChapter,
          url: href,
        });
      }
    });

    console.log(`[MeioNovel] Found ${novels.length} novels by author: ${authorName}`);
    const hasNext = $('.nav-previous a, .next').length > 0;
    const result = { data: novels, hasNext, authorName };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[MeioNovel] Error fetching by author:', error);
    return { data: [], hasNext: false, authorName: author };
  }
}

/**
 * Get novel detail by slug - uses WordPress AJAX endpoint for chapter list
 */
export async function getDetail(slug: string): Promise<NovelDetail | null> {
  const cacheKey = `meionovel:detail:${slug}`;
  const cached = await getCached<NovelDetail>(cacheKey);
  if (cached) return cached;

  try {
    // First, get the main page to extract basic info and post ID
    const url = `${BASE_URL}/novel/${slug}/`;
    console.log('[MeioNovel] Fetching novel detail:', url);
    
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    // Get post ID from various sources
    let postId = '';
    
    // Try data attribute
    postId = $('.rating-post-id, [data-id]').attr('value') || 
             $('.rating-post-id, [data-id]').attr('data-id') ||
             $('input[name="manga_id"]').val()?.toString() ||
             $('input.rating-post-id').val()?.toString() || '';
    
    // Try extracting from script or other elements
    if (!postId) {
      const scriptContent = $('script:contains("manga_id")').html() || '';
      const match = scriptContent.match(/manga_id["\s:]+(\d+)/);
      if (match) postId = match[1];
    }
    
    // Fallback: try to get from comments or other data
    if (!postId) {
      const pageSource = $.html();
      const idMatch = pageSource.match(/post[_-]?id["\s:]+["']?(\d+)/i) ||
                      pageSource.match(/data-id["\s=]+["']?(\d+)/i);
      if (idMatch) postId = idMatch[1];
    }

    console.log('[MeioNovel] Found post ID:', postId);

    const title = $('.post-title h1, h1.entry-title').first().text().trim() ||
                  slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const poster = $('.summary_image img, .thumb img').attr('src') || 
                   $('.summary_image img, .thumb img').attr('data-src') ||
                   $('.summary_image img, .thumb img').attr('data-lazy-src') || '';
    
    // Get synopsis
    let synopsis = '';
    $('.summary__content p, .description-summary p, .manga-excerpt p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) synopsis += text + '\n\n';
    });
    synopsis = synopsis.trim() || 'Tidak ada sinopsis.';

    // Get author
    const author = $('.author-content a, a[href*="novel-author"]').first().text().trim() || '';
    
    // Get genres
    const genres: string[] = [];
    $('.genres-content a, a[href*="novel-genre"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !genres.includes(text)) genres.push(text);
    });

    // Get tags
    const tags: string[] = [];
    $('.tags-content a, a[href*="novel-tag"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !tags.includes(text)) tags.push(text);
    });

    // Get status
    let status = '';
    $('.post-status .summary-content, .post-content_item').each((_, el) => {
      const $el = $(el);
      const label = $el.find('.summary-heading, h5').text().trim().toLowerCase();
      const value = $el.find('.summary-content').text().trim();
      if (label.includes('status') && value) {
        status = value;
      }
    });

    // Get release year
    const release = $('a[href*="novel-release"]').first().text().trim() || '';

    // Get alternative title
    let alternativeTitle = '';
    $('.post-content_item').each((_, el) => {
      const $el = $(el);
      const label = $el.find('.summary-heading, h5').text().trim().toLowerCase();
      const value = $el.find('.summary-content').text().trim();
      if ((label.includes('alternative') || label.includes('alt')) && value) {
        alternativeTitle = value;
      }
    });

    // Chapters - try multiple approaches
    const chapters: Chapter[] = [];
    
    // First approach: Try to get chapters directly from the page (they might be server-rendered)
    $('.wp-manga-chapter, li.wp-manga-chapter, .version-chap li').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      const chapterTitle = linkEl.text().trim();
      
      if (href && chapterTitle && href.includes(`/novel/${slug}/`)) {
        const chapterSlug = href.replace(`${BASE_URL}/novel/${slug}/`, '').replace(/\/$/, '');
        const chapterNum = chapterTitle.match(/Chapter\s*(\d+)/i)?.[1] || 
                          chapterTitle.match(/(\d+)/)?.[1] || '';
        const chapterType = chapterTitle.toLowerCase().includes('htl') ? 'HTL' : 'MTL';
        const date = $el.find('.chapter-release-date i, time').text().trim();
        
        if (!chapters.some(c => c.slug === chapterSlug)) {
          chapters.push({
            id: chapterSlug,
            number: chapterNum,
            title: chapterTitle,
            slug: chapterSlug,
            type: chapterType,
            date,
            url: href,
          });
        }
      }
    });

    // Second approach: If no chapters found and we have postId, try AJAX endpoint
    if (chapters.length === 0 && postId) {
      console.log('[MeioNovel] Trying AJAX endpoint for chapters...');
      try {
        // WordPress Madara theme AJAX endpoint for chapters
        const ajaxData = new URLSearchParams();
        ajaxData.append('action', 'manga_get_chapters');
        ajaxData.append('manga', postId);
        
        const ajaxResponse = await axiosInstance.post(
          `${BASE_URL}/wp-admin/admin-ajax.php`,
          ajaxData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': url,
            },
          }
        );
        
        if (ajaxResponse.data) {
          const $ajax = cheerio.load(ajaxResponse.data);
          $ajax('li.wp-manga-chapter, .wp-manga-chapter').each((_, el) => {
            const $el = $ajax(el);
            const linkEl = $el.find('a').first();
            const href = linkEl.attr('href') || '';
            const chapterTitle = linkEl.text().trim();
            
            if (href && chapterTitle) {
              const chapterSlug = href.replace(`${BASE_URL}/novel/${slug}/`, '').replace(/\/$/, '');
              const chapterNum = chapterTitle.match(/Chapter\s*(\d+)/i)?.[1] || 
                                chapterTitle.match(/(\d+)/)?.[1] || '';
              const chapterType = chapterTitle.toLowerCase().includes('htl') ? 'HTL' : 'MTL';
              const date = $el.find('.chapter-release-date i, time').text().trim();
              
              if (!chapters.some(c => c.slug === chapterSlug)) {
                chapters.push({
                  id: chapterSlug,
                  number: chapterNum,
                  title: chapterTitle,
                  slug: chapterSlug,
                  type: chapterType,
                  date,
                  url: href,
                });
              }
            }
          });
        }
      } catch (ajaxError) {
        console.error('[MeioNovel] AJAX chapter fetch failed:', ajaxError);
      }
    }

    // Third approach: Find chapter links anywhere on the page
    if (chapters.length === 0) {
      console.log('[MeioNovel] Trying fallback chapter extraction...');
      $(`a[href*="${slug}"]`).each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();
        
        // Match chapter patterns in URL or text
        if ((href.match(/\/mtl\/|\/htl\/|chapter-\d+|\/ch-?\d+/i) || 
             text.match(/chapter\s*\d+/i)) && text.length > 0) {
          const chapterSlug = href.replace(`${BASE_URL}/novel/${slug}/`, '').replace(/\/$/, '');
          
          if (chapterSlug && chapterSlug !== slug && !chapterSlug.includes('http') && 
              !chapters.some(c => c.slug === chapterSlug)) {
            const chapterNum = text.match(/(\d+)/)?.[1] || '';
            chapters.push({
              id: chapterSlug,
              number: chapterNum,
              title: text,
              slug: chapterSlug,
              type: text.toLowerCase().includes('htl') ? 'HTL' : 'MTL',
              date: '',
              url: href,
            });
          }
        }
      });
    }

    // Fourth approach: Parse Read First / Read Last links (Meionovels pattern)
    if (chapters.length === 0) {
      console.log('[MeioNovel] Trying Read First/Last button extraction...');
      
      // Look for Read First and Read Last buttons
      const readFirstLink = $('a:contains("Read First"), a[href*="/novel/"][href*="chapter"]').first().attr('href');
      const readLastLink = $('a:contains("Read Last"), .last_chapter a').attr('href');
      
      // Also check for buttons with class names
      const btnFirst = $('.btn-read-first a, a.btn-read-first, a[class*="first"]').attr('href') ||
                       $('a[href*="' + slug + '"][href*="chapter-1"]').attr('href') ||
                       $('a[href*="' + slug + '/htl/"]').first().attr('href') ||
                       $('a[href*="' + slug + '/mtl/"]').first().attr('href');
      const btnLast = $('.btn-read-last a, a.btn-read-last, a[class*="last"]').attr('href');
      
      const firstChapterUrl = readFirstLink || btnFirst;
      const lastChapterUrl = readLastLink || btnLast;
      
      if (firstChapterUrl && firstChapterUrl.includes(slug)) {
        const firstSlug = firstChapterUrl.replace(`${BASE_URL}/novel/${slug}/`, '').replace(/\/$/, '');
        if (firstSlug && firstSlug !== slug && !firstSlug.includes('http')) {
          // Determine type from path
          const chapterType = firstSlug.includes('htl') ? 'HTL' : 'MTL';
          const chapterNum = firstSlug.match(/chapter[-_]?(\d+)/i)?.[1] || '1';
          
          chapters.push({
            id: firstSlug,
            number: chapterNum,
            title: `Chapter ${chapterNum}`,
            slug: firstSlug,
            type: chapterType,
            date: '',
            url: firstChapterUrl,
          });
        }
      }
      
      if (lastChapterUrl && lastChapterUrl.includes(slug) && lastChapterUrl !== firstChapterUrl) {
        const lastSlug = lastChapterUrl.replace(`${BASE_URL}/novel/${slug}/`, '').replace(/\/$/, '');
        if (lastSlug && lastSlug !== slug && !lastSlug.includes('http') && 
            !chapters.some(c => c.slug === lastSlug)) {
          const chapterType = lastSlug.includes('htl') ? 'HTL' : 'MTL';
          const chapterNum = lastSlug.match(/(\d+)/)?.[1] || 'Latest';
          
          chapters.push({
            id: lastSlug,
            number: chapterNum,
            title: `Chapter ${chapterNum} (Latest)`,
            slug: lastSlug,
            type: chapterType,
            date: '',
            url: lastChapterUrl,
          });
        }
      }
    }

    // Fifth approach: Use Puppeteer as final fallback for JS-rendered content
    // Also run if we only got 2 chapters (likely just Read First/Last buttons)
    if (chapters.length <= 2) {
      console.log('[MeioNovel] Trying Puppeteer for JS-rendered chapters...');
      try {
        const puppeteer = await import('puppeteer');
        const browser = await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        
        // Wait for initial content
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('[MeioNovel] Page loaded, looking for Show more button...');
        
        // Scroll down to see chapter section
        await page.evaluate(() => {
          window.scrollBy(0, 800);
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to click "Show more" button using multiple approaches
        let showMoreClicked = false;
        
        // Approach 1: Use page.click() with selectors
        const buttonSelectors = [
          'span.content-readmore',
          '.content-readmore',
          '.btn-link.content-readmore',
          'span.btn-link'
        ];
        
        for (const selector of buttonSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            await page.click(selector);
            showMoreClicked = true;
            console.log(`[MeioNovel] Clicked button with selector: ${selector}`);
            break;
          } catch {
            // Selector not found, try next
          }
        }
        
        // Approach 2: If no selector worked, try clicking by text content
        if (!showMoreClicked) {
          showMoreClicked = await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('span, button, a'));
            for (const el of spans) {
              const text = (el.textContent || '').toLowerCase();
              if (text.includes('show more') || text.includes('show all') || text.includes('tampilkan')) {
                (el as HTMLElement).click();
                return true;
              }
            }
            return false;
          });
          if (showMoreClicked) {
            console.log('[MeioNovel] Clicked Show more via text search');
          }
        }
        
        if (showMoreClicked) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.log('[MeioNovel] No Show more button found, trying scroll anyway');
        }
        
        // Perform infinite scroll to load all chapters
        console.log('[MeioNovel] Starting infinite scroll to load chapters...');
        
        let previousChapterCount = 0;
        let sameCountRetries = 0;
        const maxScrollAttempts = 200; // More scroll attempts for novels with 2000+ chapters
        
        for (let scrollAttempt = 0; scrollAttempt < maxScrollAttempts; scrollAttempt++) {
          // Scroll to bottom using page.evaluate
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          
          // Wait for content to load
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Count current chapters
          const currentCount = await page.evaluate(() => {
            return document.querySelectorAll('li.wp-manga-chapter, .wp-manga-chapter').length;
          });
          
          if (currentCount === previousChapterCount) {
            sameCountRetries++;
            if (sameCountRetries >= 15) {
              console.log(`[MeioNovel] No new chapters after ${scrollAttempt + 1} scrolls. Total: ${currentCount}`);
              break;
            }
          } else {
            sameCountRetries = 0;
            previousChapterCount = currentCount;
          }
          
          // Log progress every 10 scrolls
          if (scrollAttempt % 10 === 0) {
            console.log(`[MeioNovel] Scroll ${scrollAttempt}: ${currentCount} chapters loaded`);
          }
        }
        
        console.log(`[MeioNovel] Finished scrolling. Extracting chapters...`);


        // @ts-ignore - This code runs in browser context via Puppeteer
        const puppeteerChapters = await page.evaluate((novelSlug, baseUrl) => {
          const found: { id: string; number: string; title: string; slug: string; type: string; date: string; url: string }[] = [];
          
          // Look for chapter list items first
          // @ts-ignore
          const chapterItems = document.querySelectorAll('li.wp-manga-chapter, .wp-manga-chapter, .version-chap li');
          // @ts-ignore
          chapterItems.forEach(function(li: any) {
            const anchor = li.querySelector('a');
            if (!anchor) return;
            
            const href = anchor.href || '';
            const text = (anchor.textContent || '').trim();
            
            if (href.indexOf('/novel/' + novelSlug + '/') > -1 && text.length > 0) {
              const chapterSlug = href.replace(baseUrl + '/novel/' + novelSlug + '/', '').replace(/\/$/, '');
              if (chapterSlug && chapterSlug !== novelSlug && chapterSlug.indexOf('http') === -1 &&
                  !found.some(function(c) { return c.slug === chapterSlug; })) {
                const numMatch = text.match(/(\d+)/);
                const num = numMatch ? numMatch[1] : '';
                const dateEl = li.querySelector('.chapter-release-date i, time, .chapterdate');
                const date = dateEl ? dateEl.textContent.trim() : '';
                
                found.push({
                  id: chapterSlug,
                  number: num,
                  title: text,
                  slug: chapterSlug,
                  type: chapterSlug.indexOf('htl') > -1 ? 'HTL' : 'MTL',
                  date: date,
                  url: href,
                });
              }
            }
          });
          
          // If no chapters found from list, try any chapter links
          if (found.length === 0) {
            // @ts-ignore
            const links = Array.from(document.querySelectorAll('a[href*="' + novelSlug + '/"]'));
            // @ts-ignore
            links.forEach(function(el: any) {
              const href = el.href || '';
              const text = (el.textContent || '').trim();
              
              if ((href.indexOf('/mtl/') > -1 || href.indexOf('/htl/') > -1 || 
                   /chapter[-_]?\d+/i.test(href) || /chapter\s*\d+/i.test(text)) && 
                  text.length > 0 && text.length < 100) {
                const chapterSlug = href.replace(baseUrl + '/novel/' + novelSlug + '/', '').replace(/\/$/, '');
                if (chapterSlug && chapterSlug !== novelSlug && chapterSlug.indexOf('http') === -1 &&
                    !found.some(function(c) { return c.slug === chapterSlug; })) {
                  const numMatch = text.match(/(\d+)/);
                  const num = numMatch ? numMatch[1] : '';
                  found.push({
                    id: chapterSlug,
                    number: num,
                    title: text,
                    slug: chapterSlug,
                    type: chapterSlug.indexOf('htl') > -1 ? 'HTL' : 'MTL',
                    date: '',
                    url: href,
                  });
                }
              }
            });
          }
          
          return found;
        }, slug, BASE_URL);

        await browser.close();
        
        if (puppeteerChapters.length > 0) {
          chapters.push(...puppeteerChapters);
          console.log(`[MeioNovel] Puppeteer found ${puppeteerChapters.length} chapters`);
        }
      } catch (puppeteerError) {
        console.error('[MeioNovel] Puppeteer fallback failed:', puppeteerError);
      }
    }

    // Extract related novels from "YOU MAY ALSO LIKE" section
    const related: NovelItem[] = [];
    const seenRelated = new Set<string>();
    
    // Correct selectors for meionovels.com related section
    $('.related-manga-container .item').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('.item-thumb a, .post-title a').first();
      const href = linkEl.attr('href') || '';
      
      // Extract slug from URL
      const slugMatch = href.match(/\/novel\/([^/]+)/);
      if (!slugMatch) return;
      
      const relatedSlug = slugMatch[1];
      if (seenRelated.has(relatedSlug) || relatedSlug === slug) return; // Skip duplicates and current novel
      seenRelated.add(relatedSlug);
      
      const relatedTitle = $el.find('.post-title h5 a, .item-details .post-title a').first().text().trim() ||
                          linkEl.attr('title') || '';
      const relatedPoster = $el.find('.item-thumb img').attr('src') || 
                           $el.find('.item-thumb img').attr('data-src') || '';
      
      if (relatedTitle) {
        related.push({
          id: relatedSlug,
          title: relatedTitle,
          slug: relatedSlug,
          poster: relatedPoster,
          url: href,
        });
      }
    });

    // If no related found with specific selectors, try to get from sidebar or bottom section
    if (related.length === 0) {
      $('.sidebar .c-blog__item, .c-sidebar .slider__item, .widget .page-item-detail').each((_, el) => {
        const $el = $(el);
        const linkEl = $el.find('a').first();
        const href = linkEl.attr('href') || '';
        
        const slugMatch = href.match(/\/novel\/([^/]+)/);
        if (!slugMatch) return;
        
        const relatedSlug = slugMatch[1];
        if (seenRelated.has(relatedSlug) || relatedSlug === slug) return;
        seenRelated.add(relatedSlug);
        
        const relatedTitle = $el.find('.post-title a, .name, h5').first().text().trim() ||
                            linkEl.attr('title') || '';
        const relatedPoster = $el.find('img').attr('src') || 
                             $el.find('img').attr('data-src') || '';
        
        if (relatedTitle && related.length < 10) {
          related.push({
            id: relatedSlug,
            title: relatedTitle,
            slug: relatedSlug,
            poster: relatedPoster,
            url: href,
          });
        }
      });
    }

    // Fallback: If still no related found, fetch novels from the same genre
    if (related.length === 0 && genres.length > 0) {
      try {
        // Get first genre and fetch novels from it
        const firstGenre = genres[0].toLowerCase().replace(/\s+/g, '-');
        console.log(`[MeioNovel] Fetching related by genre: ${firstGenre}`);
        const genreResult = await getByGenre(firstGenre, 1);
        
        if (genreResult.data && genreResult.data.length > 0) {
          // Filter out current novel and take up to 6
          const relatedFromGenre = genreResult.data
            .filter((novel: NovelItem) => novel.slug !== slug)
            .slice(0, 6);
          
          related.push(...relatedFromGenre);
          console.log(`[MeioNovel] Added ${relatedFromGenre.length} related novels from genre`);
        }
      } catch (genreError) {
        console.error('[MeioNovel] Failed to fetch related by genre:', genreError);
      }
    }
    
    console.log(`[MeioNovel] Found ${related.length} related novels`);
    console.log(`[MeioNovel] Found ${chapters.length} chapters for ${slug}`);

    const detail: NovelDetail = {
      id: slug,
      title,
      slug,
      poster,
      alternativeTitle,
      author,
      genres,
      novelType: '',
      tags,
      release,
      status,
      synopsis,
      chapters,
      related,
      url,
    };

    if (detail.title) {
      await setCache(cacheKey, detail);
    }
    
    return detail;
  } catch (error) {
    console.error('[MeioNovel] Error fetching detail:', error);
    return null;
  }
}

/**
 * Get chapter content for reading
 */
export async function getChapter(novelSlug: string, chapterSlug: string): Promise<ChapterContent | null> {
  const cacheKey = `meionovel:chapter:${novelSlug}:${chapterSlug}`;
  const cached = await getCached<ChapterContent>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/novel/${novelSlug}/${chapterSlug}/`;
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const title = $('.entry-title, h1.text-center, .chapter-title').first().text().trim();
    const novelTitle = $('.parent-title a, .breadcrumb li:nth-child(2) a, a[href*="/novel/"]').first().text().trim();
    const chapterNumber = title.match(/Chapter\s*(\d+)/i)?.[1] || '';

    // Get chapter content - the main text
    let content = '';
    
    // Try different selectors for content
    const contentEl = $('.text-left, .reading-content, .entry-content, .chapter-content');
    if (contentEl.length) {
      // Get text with paragraph breaks preserved
      contentEl.find('p, br').each((_, el) => {
        const tagName = el.tagName;
        const text = $(el).text().trim();
        if (tagName === 'p' && text) {
          content += text + '\n\n';
        } else if (tagName === 'br') {
          content += '\n';
        }
      });
      
      // Fallback to full text if no paragraphs
      if (!content.trim()) {
        content = contentEl.text().trim();
      }
    }

    // Navigation
    const prevChapter = $('.prev_page a, .nav-previous a, a[rel="prev"]').attr('href')?.replace(`${BASE_URL}/novel/${novelSlug}/`, '').replace(/\/$/, '');
    const nextChapter = $('.next_page a, .nav-next a, a[rel="next"]').attr('href')?.replace(`${BASE_URL}/novel/${novelSlug}/`, '').replace(/\/$/, '');

    const chapterContent: ChapterContent = {
      title,
      novelTitle,
      chapterNumber,
      content: content || 'Konten tidak dapat dimuat.',
      prevChapter,
      nextChapter,
    };

    await setCache(cacheKey, chapterContent);
    return chapterContent;
  } catch (error) {
    console.error('[MeioNovel] Error fetching chapter:', error);
    return null;
  }
}

/**
 * Search novels
 */
export async function search(query: string, page: number = 1): Promise<{ data: NovelItem[]; hasNext: boolean }> {
  const cacheKey = `meionovel:search:${query}:${page}`;
  const cached = await getCached<{ data: NovelItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 
      ? `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=wp-manga`
      : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
    
    console.log('[MeioNovel] Search URL:', url);
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const novels: NovelItem[] = [];
    const seen = new Set<string>();

    // Multiple selectors for different search result layouts
    const searchSelectors = [
      '.c-tabs-item__content',
      '.search-wrap .row',
      '.tab-content-wrap .c-tabs-item__content',
      '.c-blog__item',
      '.manga-item',
      '.page-item-detail',
      '.item-thumb',
      'article.search-result'
    ];
    
    let found = false;
    for (const selector of searchSelectors) {
      $(selector).each((_, el) => {
        found = true;
        const $el = $(el);
        
        // Try multiple link selectors
        const linkEl = $el.find('.post-title a, h3 a, h4 a, .item-title a, a.link').first();
        if (!linkEl.length) return;
        
        const href = linkEl.attr('href') || '';
        const title = linkEl.text().trim() || linkEl.attr('title') || '';
        
        // Get poster with multiple fallbacks
        const poster = $el.find('img').attr('src') || 
                       $el.find('img').attr('data-src') ||
                       $el.find('img').attr('data-lazy-src') || '';

        if (href && title && href.includes('/novel/')) {
          const match = href.match(/\/novel\/([^/]+)/);
          const slug = match ? match[1] : '';
          
          if (seen.has(slug) || !slug) return;
          seen.add(slug);
          
          novels.push({
            id: slug,
            title: title.substring(0, 150),
            slug,
            poster,
            url: href,
          });
        }
      });
      if (found && novels.length > 0) break;
    }

    // If still no results, try finding any novel links on the page
    if (novels.length === 0) {
      $('a[href*="/novel/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const title = $el.text().trim() || $el.attr('title') || '';
        
        if (href && title && title.length > 3 && !href.includes('novel-genre') && !href.includes('novel-tag')) {
          const match = href.match(/\/novel\/([^/]+)/);
          const slug = match ? match[1] : '';
          
          if (seen.has(slug) || !slug || slug.includes('/')) return;
          seen.add(slug);
          
          // Find nearby image
          const parent = $el.closest('.c-tabs-item__content, .item, article, .manga, div');
          const poster = parent.find('img').attr('src') || parent.find('img').attr('data-src') || '';
          
          novels.push({
            id: slug,
            title: title.substring(0, 150),
            slug,
            poster,
            url: href,
          });
        }
      });
    }

    console.log(`[MeioNovel] Search for "${query}" found ${novels.length} results`);
    
    const hasNext = $('.nav-previous a, .next, a.nextpostslink').length > 0;
    const result = { data: novels, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[MeioNovel] Error searching:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get all genres
 */
export async function getGenres(): Promise<{ name: string; slug: string; count: number }[]> {
  const cacheKey = 'meionovel:genres';
  const cached = await getCached<{ name: string; slug: string; count: number }[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data: html } = await axiosInstance.get(`${BASE_URL}/novel/`);
    const $ = cheerio.load(html);

    const genres: { name: string; slug: string; count: number }[] = [];

    // Try to find genre list
    $('.genres_wrap a, .widget-genres a, a[href*="novel-genre"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const text = $el.text().trim();
      
      // Extract genre name and count
      const match = text.match(/^(.+?)\s*\((\d+)\)$/);
      const name = match ? match[1] : text;
      const count = match ? parseInt(match[2]) : 0;
      
      // Extract slug from URL
      const slugMatch = href.match(/\/novel-genre\/([^/]+)/);
      const slug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/\s+/g, '-');

      if (name && !genres.some(g => g.slug === slug)) {
        genres.push({ name, slug, count });
      }
    });

    await setCache(cacheKey, genres);
    return genres;
  } catch (error) {
    console.error('[MeioNovel] Error fetching genres:', error);
    return [];
  }
}

/**
 * Get all tags
 */
export async function getTags(): Promise<{ name: string; slug: string; count: number }[]> {
  const cacheKey = 'meionovel:tags';
  const cached = await getCached<{ name: string; slug: string; count: number }[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data: html } = await axiosInstance.get(`${BASE_URL}/novel/`);
    const $ = cheerio.load(html);

    const tags: { name: string; slug: string; count: number }[] = [];

    // Try to find tag list - tags usually have different URL pattern than genres
    $('.tags_wrap a, .widget-tags a, a[href*="novel-tag"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const text = $el.text().trim();
      
      // Skip if it's a genre link
      if (href.includes('novel-genre')) return;
      
      // Extract tag name and count
      const match = text.match(/^(.+?)\s*\((\d+)\)$/);
      const name = match ? match[1] : text;
      const count = match ? parseInt(match[2]) : 0;
      
      // Extract slug from URL
      const slugMatch = href.match(/\/novel-tag\/([^/]+)/);
      const slug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/\s+/g, '-');

      if (name && slug && !tags.some(t => t.slug === slug)) {
        tags.push({ name, slug, count });
      }
    });

    console.log(`[MeioNovel] Found ${tags.length} tags`);
    await setCache(cacheKey, tags);
    return tags;
  } catch (error) {
    console.error('[MeioNovel] Error fetching tags:', error);
    return [];
  }
}

/**
 * Get novels by tag
 */
export async function getByTag(tag: string, page: number = 1): Promise<{ data: NovelItem[]; hasNext: boolean }> {
  const cacheKey = `meionovel:tag:${tag}:${page}`;
  const cached = await getCached<{ data: NovelItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1 
      ? `${BASE_URL}/novel-tag/${tag}/` 
      : `${BASE_URL}/novel-tag/${tag}/page/${page}/`;
    
    console.log('[MeioNovel] Fetching tag page:', url);
    const { data: html } = await axiosInstance.get(url);
    const $ = cheerio.load(html);

    const novels: NovelItem[] = [];
    const seen = new Set<string>();

    $('.page-item-detail, .manga').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href') || '';
      
      const title = $el.find('.post-title h3 a, .post-title a').first().text().trim() ||
                    linkEl.attr('title') || '';
      
      const poster = $el.find('img').attr('src') || 
                     $el.find('img').attr('data-src') || '';

      const latestChapter = $el.find('.chapter a, .list-chapter a').first().text().trim();

      if (href && title) {
        const match = href.match(/\/novel\/([^/]+)/);
        const slug = match ? match[1] : '';
        
        if (seen.has(slug) || !slug) return;
        seen.add(slug);
        
        novels.push({
          id: slug,
          title: title.substring(0, 150),
          slug,
          poster,
          latestChapter,
          url: href,
        });
      }
    });

    console.log(`[MeioNovel] Found ${novels.length} novels for tag: ${tag}`);
    const hasNext = $('.nav-previous a, .next').length > 0;
    const result = { data: novels, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[MeioNovel] Error fetching by tag:', error);
    return { data: [], hasNext: false };
  }
}

export default {
  getLatest,
  getPopular,
  getByCategory,
  getByGenre,
  getByAuthor,
  getByTag,
  getDetail,
  getChapter,
  search,
  getGenres,
  getTags,
};
