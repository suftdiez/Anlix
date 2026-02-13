import axios from 'axios';
import * as cheerio from 'cheerio';
import * as vm from 'vm';
import redis from '../config/redis';

const BASE_URL = 'https://rebahinxxi3.work';
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

export interface DramaItem {
  id: string;
  title: string;
  slug: string;
  poster: string;
  episodeInfo?: string;   // e.g. "Eps 24 ON", "Eps 30 END"
  rating?: string;
  duration?: string;
  url: string;
}

export interface DramaDetail {
  title: string;
  poster: string;
  synopsis: string;
  genres: string[];
  actors: string[];
  directors: string[];
  country: string;
  releaseDate: string;
  duration: string;
  quality: string;
  episodeInfo?: string;
}

export interface EpisodeItem {
  number: string;       // e.g. "EP 1", "EP 2"
  streamUrl: string;    // decoded base64 iframe URL
}

export interface DramaEpisodesResult {
  title: string;
  episodes: EpisodeItem[];
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
 * Parse drama cards from a listing page (.ml-item elements)
 */
function parseDramaCards($: cheerio.CheerioAPI): DramaItem[] {
  const results: DramaItem[] = [];

  $('.ml-item').each((_, el) => {
    const linkEl = $(el).find('a.ml-mask');
    const imgEl = $(el).find('img.mli-thumb');
    const epsEl = $(el).find('.mli-eps');
    const ratingEl = $(el).find('.mli-rating');
    const durationEl = $(el).find('.mli-durasi');

    const url = linkEl.attr('href') || '';
    const title = linkEl.attr('title') || linkEl.find('.mli-info h2').text().trim() || '';
    const poster = imgEl.attr('data-original') || imgEl.attr('src') || imgEl.attr('data-src') || '';
    const episodeInfo = epsEl.text().trim() || '';
    const rating = ratingEl.text().trim() || '';
    const duration = durationEl.text().trim() || '';

    if (url && title) {
      // Extract slug from URL: https://rebahinxxi3.work/series/slug/ -> slug
      const slugMatch = url.match(/\/series\/([^/]+)\/?$/);
      const slug = slugMatch ? slugMatch[1] : url.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '');

      results.push({
        id: slug,
        title,
        slug,
        poster,
        episodeInfo,
        rating,
        duration,
        url,
      });
    }
  });

  return results;
}

/**
 * Get Chinese drama listing from /genre/drama-china/page/{n}/
 */
export async function getDramaChinaList(page: number = 1): Promise<{ data: DramaItem[]; hasNext: boolean }> {
  const cacheKey = `rebahin:china:page:${page}`;
  const cached = await getCached<{ data: DramaItem[]; hasNext: boolean }>(cacheKey);
  if (cached) return cached;

  try {
    const url = page === 1
      ? `${BASE_URL}/genre/drama-china/`
      : `${BASE_URL}/genre/drama-china/page/${page}/`;

    const html = await throttledRequest(url);
    const $ = cheerio.load(html);
    const data = parseDramaCards($);

    // Check for next page
    const hasNext = $('.pagination a.next, .pagination .next, a[rel="next"]').length > 0 ||
                    $(`.pagination a:contains("${page + 1}")`).length > 0;

    const result = { data, hasNext };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Rebahin getDramaChinaList error:', error);
    return { data: [], hasNext: false };
  }
}

/**
 * Get drama detail page info
 */
export async function getDramaDetail(slug: string): Promise<DramaDetail | null> {
  const cacheKey = `rebahin:detail:${slug}`;
  const cached = await getCached<DramaDetail>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/series/${slug}/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    // Title
    const title = $('h1').first().text().trim()
      .replace(/Nonton (?:Film |Series )?(?:Online )?/gi, '')
      .replace(/\s*\|.*$/, '')
      .trim();

    if (!title) return null;

    // Poster — use og:image first (most reliable), then try img tags
    let poster = $('meta[property="og:image"]').attr('content') ||
                   $('.thumb.mvic-thumb img, .thumb.mvi-cover img, .mvic-thumb img, article img').first().attr('src') ||
                   $('.thumb.mvic-thumb img, .thumb.mvi-cover img, .mvic-thumb img, article img').first().attr('data-src') || '';
    // Ensure absolute URL
    if (poster && poster.startsWith('/')) {
      poster = BASE_URL + poster;
    }

    // Synopsis
    let synopsis = '';
    const descEl = $('.desc, .mvic-desc').first();
    if (descEl.length) {
      synopsis = descEl.find('p').first().text().trim();
    }
    if (!synopsis) {
      // Fallback: try .wp-content first paragraph
      synopsis = $('.wp-content p, .entry-content p').first().text().trim();
    }

    // Info fields from <p> tags in .mvici-left or .mvici-right
    const genres: string[] = [];
    const actors: string[] = [];
    const directors: string[] = [];
    let country = '';
    let releaseDate = '';
    let duration = '';
    let quality = '';

    $('.mvici-left p, .mvici-right p, .mvic-info p').each((_, el) => {
      const text = $(el).text().trim();
      const label = text.split(':')[0]?.trim().toLowerCase() || '';

      if (label.includes('genre')) {
        $(el).find('a').each((_, a) => {
          const genre = $(a).text().trim();
          if (genre && !genre.includes('Drama China')) genres.push(genre);
        });
      } else if (label.includes('actor') || label.includes('stars') || label.includes('cast')) {
        $(el).find('a').each((_, a) => { actors.push($(a).text().trim()); });
      } else if (label.includes('director')) {
        $(el).find('a').each((_, a) => { directors.push($(a).text().trim()); });
      } else if (label.includes('countr')) {
        country = $(el).find('a').text().trim() || text.split(':')[1]?.trim() || '';
      } else if (label.includes('release') || label.includes('rilis')) {
        releaseDate = text.split(':').slice(1).join(':').trim();
      } else if (label.includes('duration') || label.includes('durasi')) {
        duration = text.split(':').slice(1).join(':').trim();
      } else if (label.includes('quality') || label.includes('kualitas')) {
        quality = text.split(':').slice(1).join(':').trim();
      }
    });

    // Episode info
    const episodeInfo = $('.mli-eps, .epcount').text().trim() || '';

    const result: DramaDetail = {
      title,
      poster,
      synopsis,
      genres,
      actors,
      directors,
      country,
      releaseDate,
      duration,
      quality,
      episodeInfo,
    };

    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Rebahin getDramaDetail error:', error);
    return null;
  }
}

/**
 * Get episodes with streaming URLs from the /watch/ subpage
 * Episodes use btn-eps elements with base64-encoded data-iframe attributes
 */
export async function getDramaEpisodes(slug: string): Promise<DramaEpisodesResult | null> {
  const cacheKey = `rebahin:episodes:${slug}`;
  const cached = await getCached<DramaEpisodesResult>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/series/${slug}/watch/`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    // Title
    const title = $('h1, .data h1, .entry-title').first().text().trim()
      .replace(/Nonton (?:Film |Series )?(?:Online )?/gi, '')
      .replace(/\s*\|.*$/, '')
      .trim() || slug.replace(/-/g, ' ');

    const episodes: EpisodeItem[] = [];

    // Parse episode buttons from #list-eps
    // Deduplicate by episode number (each episode may have multiple servers)
    const seenEps = new Set<string>();
    $('#list-eps .btn-eps, .btn-eps').each((_, el) => {
      const epText = $(el).text().trim();
      const dataIframe = $(el).attr('data-iframe') || '';

      // Skip duplicate episode numbers (keep first server)
      if (seenEps.has(epText)) return;

      if (dataIframe) {
        // Decode base64 iframe URL
        let streamUrl = '';
        try {
          streamUrl = Buffer.from(dataIframe, 'base64').toString('utf-8');
        } catch {
          streamUrl = dataIframe; // Use raw value if not base64
        }

        if (streamUrl) {
          seenEps.add(epText);
          episodes.push({
            number: epText || `EP ${episodes.length + 1}`,
            streamUrl,
          });
        }
      }
    });

    // Fallback: look for episode links in other formats
    if (episodes.length === 0) {
      $('a[href*="episode"], .les-content a').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        if (text && href && href.includes(slug)) {
          episodes.push({
            number: text,
            streamUrl: href,
          });
        }
      });
    }

    if (episodes.length === 0) return null;

    const result: DramaEpisodesResult = { title, episodes };
    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Rebahin getDramaEpisodes error:', error);
    return null;
  }
}

/**
 * Search drama on Rebahin
 */
export async function searchDrama(query: string): Promise<DramaItem[]> {
  const cacheKey = `rebahin:search:${query}`;
  const cached = await getCached<DramaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=post`;
    const html = await throttledRequest(url);
    const $ = cheerio.load(html);

    // Search results use the same .ml-item structure
    let results = parseDramaCards($);

    // Fallback: Try result-item format
    if (results.length === 0) {
      $('.result-item, .search-page .item, article').each((_, el) => {
        const linkEl = $(el).find('a').first();
        const imgEl = $(el).find('img').first();
        const titleEl = $(el).find('.title, h2, h3').first();

        const itemUrl = linkEl.attr('href') || '';
        const itemTitle = titleEl.text().trim() || linkEl.text().trim();
        const poster = imgEl.attr('data-original') || imgEl.attr('src') || imgEl.attr('data-src') || '';

        if (itemUrl && itemTitle && itemUrl.includes('/series/')) {
          const slugMatch = itemUrl.match(/\/series\/([^/]+)\/?$/);
          const slugVal = slugMatch ? slugMatch[1] : '';

          if (slugVal) {
            results.push({
              id: slugVal,
              title: itemTitle,
              slug: slugVal,
              poster,
              url: itemUrl,
            });
          }
        }
      });
    }

    await setCache(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Rebahin searchDrama error:', error);
    return [];
  }
}

// ============================================
// STREAM URL EXTRACTION (JuicyCodes decode)
// ============================================

interface StreamInfo {
  file: string;       // HLS m3u8 URL
  image?: string;     // Thumbnail
  type?: string;      // 'hls'
  labels?: Record<string, string>;
}

/**
 * Create a comprehensive browser-like sandbox for running embed scripts in Node.js VM
 */
function createBrowserSandbox(embedUrl: string) {
  const noop = () => {};
  const capturedEvals: string[] = [];

  const sandbox: any = {
    String, Array, Object, Number, Boolean, RegExp, Error, TypeError, RangeError, SyntaxError,
    JSON, Math, Date, Promise, parseInt, parseFloat, isNaN, isFinite, NaN, Infinity, undefined,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    Map, Set, Symbol, Proxy, Reflect, ArrayBuffer, Uint8Array, Int32Array, Float64Array,
    DataView, TextEncoder, TextDecoder, URL, WeakMap, WeakSet,

    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
    setTimeout: (fn: Function) => { try { if (typeof fn === 'function') fn(); } catch {} return 1; },
    setInterval: () => 1,
    clearInterval: noop, clearTimeout: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    postMessage: noop, open: noop, close: noop, focus: noop, blur: noop,
    scrollTo: noop,
    getComputedStyle: () => new Proxy({}, { get: () => '0px' }),
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),

    console: { log: noop, error: noop, warn: noop, info: noop, debug: noop, trace: noop, dir: noop, time: noop, timeEnd: noop, group: noop, groupEnd: noop },
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      language: 'en-US', languages: ['en-US'], platform: 'Win32',
      vendor: 'Google Inc.', maxTouchPoints: 0, hardwareConcurrency: 8,
      deviceMemory: 8, connection: { effectiveType: '4g' },
      mediaDevices: { enumerateDevices: () => Promise.resolve([]) },
      plugins: [], mimeTypes: [], webdriver: false,
    },
    location: {
      href: embedUrl, hostname: new URL(embedUrl).hostname,
      protocol: 'https:', origin: new URL(embedUrl).origin,
      pathname: new URL(embedUrl).pathname, search: '', hash: '',
      host: new URL(embedUrl).host, replace: noop, assign: noop, reload: noop,
    },
    history: { pushState: noop, replaceState: noop },
    performance: { now: () => Date.now(), mark: noop, measure: noop },
    crypto: { getRandomValues: (arr: Uint8Array) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } },
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
    innerWidth: 1920, innerHeight: 1080, outerWidth: 1920, outerHeight: 1080,
    devicePixelRatio: 1,

    XMLHttpRequest: function() {
      return {
        open: noop, send: noop, abort: noop, setRequestHeader: noop,
        addEventListener: noop, removeEventListener: noop,
        readyState: 4, status: 200, responseText: '{}', response: '{}',
        onload: null, onerror: null, onreadystatechange: null,
        getAllResponseHeaders: () => '', getResponseHeader: () => null,
      };
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve(''), headers: { get: () => null } }),
    Image: function() { return { addEventListener: noop, removeEventListener: noop, src: '' }; },
    Audio: function() { return { addEventListener: noop, play: () => Promise.resolve(), pause: noop, src: '' }; },
    Event: function() {}, CustomEvent: function() {},
    MutationObserver: function() { return { observe: noop, disconnect: noop }; },
    ResizeObserver: function() { return { observe: noop, disconnect: noop }; },
    IntersectionObserver: function() { return { observe: noop, disconnect: noop }; },
    MediaSource: function() { return { addEventListener: noop }; },

    document: new Proxy({}, {
      get(_target: any, prop: string | symbol) {
        if (prop === 'createElement') return () => new Proxy({
          style: {}, children: [], childNodes: [],
          setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
          appendChild: noop, removeChild: noop, insertBefore: noop,
          addEventListener: noop, removeEventListener: noop,
          classList: { add: noop, remove: noop, contains: () => false },
          getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
          getContext: () => ({
            fillRect: noop, fillText: noop, measureText: () => ({ width: 0 }),
            getImageData: () => ({ data: new Uint8Array(4) }),
            arc: noop, fill: noop, beginPath: noop, closePath: noop,
            canvas: { toDataURL: () => 'data:,' },
          }),
          toDataURL: () => 'data:,',
          src: '', href: '', textContent: '', innerHTML: '', innerText: '',
          parentNode: null, nextSibling: null,
        }, { get: (t: any, p: string) => p in t ? t[p] : noop });
        if (['getElementById', 'querySelector'].includes(prop as string)) return () => null;
        if (['querySelectorAll', 'getElementsByTagName', 'getElementsByClassName'].includes(prop as string)) return () => [];
        if (['addEventListener', 'removeEventListener'].includes(prop as string)) return noop;
        if (prop === 'createDocumentFragment') return () => ({ appendChild: noop, children: [] });
        if (prop === 'createTextNode') return () => ({});
        if (prop === 'createEvent') return () => ({ initEvent: noop });
        if (prop === 'head') return { appendChild: noop };
        if (prop === 'body') return { appendChild: noop, style: {} };
        if (prop === 'documentElement') return { style: {}, classList: { add: noop } };
        if (prop === 'cookie') return '';
        if (prop === 'domain') return new URL(embedUrl).hostname;
        if (prop === 'readyState') return 'complete';
        if (prop === 'hidden') return false;
        if (prop === 'visibilityState') return 'visible';
        if (typeof prop === 'symbol') return undefined;
        return noop;
      }
    }),
    _capturedEvals: capturedEvals,
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.parent = sandbox;
  sandbox.top = sandbox;
  sandbox.frames = sandbox;

  return { sandbox, capturedEvals };
}

/**
 * Extract the actual stream URL from a Rebahin embed page by decoding JuicyCodes
 */
export async function getStreamUrl(embedUrl: string): Promise<StreamInfo | null> {
  const cacheKey = `rebahin:stream:${Buffer.from(embedUrl).toString('base64').substring(0, 40)}`;
  const cached = await getCached<StreamInfo>(cacheKey);
  if (cached) return cached;

  try {
    console.log(`[Rebahin] Extracting stream from: ${embedUrl}`);

    // 1. Fetch the embed page
    const { data: embedHtml } = await axiosInstance.get(embedUrl, {
      headers: { ...axiosInstance.defaults.headers, Referer: 'https://rebahinxxi3.work/' } as any,
    });

    const $e = cheerio.load(embedHtml);

    // 2. Collect script URLs and inline scripts
    const scriptUrls: string[] = [];
    $e('script[src]').each((_, el) => {
      scriptUrls.push($e(el).attr('src')!);
    });

    const inlineScripts: string[] = [];
    $e('script').each((_, el) => {
      const content = $e(el).html() || '';
      if (content.length > 0) inlineScripts.push(content);
    });

    // 3. Fetch external scripts (we need player.js which defines _juicycodes)
    const externalScripts: string[] = [];
    for (const url of scriptUrls) {
      try {
        const { data } = await axiosInstance.get(url, {
          headers: { ...axiosInstance.defaults.headers, Referer: embedUrl } as any,
        });
        externalScripts.push(data);
      } catch {
        externalScripts.push('');
      }
    }

    // 4. Create VM sandbox and run scripts
    const { sandbox, capturedEvals } = createBrowserSandbox(embedUrl);
    const context = vm.createContext(sandbox);

    // Override eval to capture decoded output
    sandbox.eval = function(code: string) {
      capturedEvals.push(code);
      try {
        return vm.runInContext(code, context, { timeout: 5000 });
      } catch {
        return undefined;
      }
    };

    // Run external scripts (player.js defines _juicycodes)
    for (const script of externalScripts) {
      if (!script) continue;
      try {
        vm.runInContext(script, context, { timeout: 10000 });
      } catch {}
    }

    if (typeof sandbox._juicycodes !== 'function') {
      console.error('[Rebahin] _juicycodes not defined after running scripts');
      return null;
    }

    // Run inline scripts (contains the _juicycodes() call)
    for (const script of inlineScripts) {
      try {
        vm.runInContext(script, context, { timeout: 10000 });
      } catch {}
    }

    // 5. Parse the decoded config from captured evals
    for (const evalCode of capturedEvals) {
      const configMatch = evalCode.match(/var\s+config\s*=\s*(\{[\s\S]+?\});/);
      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1].replace(/\\\//g, '/'));
          const streamInfo: StreamInfo = {
            file: config.sources?.file || config.file || '',
            image: config.image || '',
            type: config.sources?.type || 'hls',
            labels: config.sources?.labels || {},
          };

          if (streamInfo.file) {
            console.log(`[Rebahin] Stream extracted: ${streamInfo.file.substring(0, 80)}...`);
            await setCache(cacheKey, streamInfo);
            return streamInfo;
          }
        } catch (parseErr) {
          console.error('[Rebahin] Config parse error:', parseErr);
        }
      }
    }

    console.error('[Rebahin] Could not find stream config in decoded output');
    return null;
  } catch (error) {
    console.error('[Rebahin] getStreamUrl error:', error);
    return null;
  }
}

export default {
  getDramaChinaList,
  getDramaDetail,
  getDramaEpisodes,
  searchDrama,
  getStreamUrl,
};
