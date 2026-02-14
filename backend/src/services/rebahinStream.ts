/**
 * Puppeteer-based stream extraction for Rebahin embeds.
 * 
 * The CDN (daisy.groovy.monster) validates:
 * 1. TLS fingerprint (JA3/JA4) — only real browsers pass
 * 2. Page origin/context — fetch() from the embed page context works,
 *    but about:blank or different origins get 403
 * 
 * Architecture:
 * 1. Open embed page in Puppeteer → intercept m3u8 via network events
 * 2. Keep embed page ALIVE as a persistent session
 * 3. For segment proxying → use page.evaluate(fetch) on the embed page
 *    This reuses the page's origin context + browser TLS = segments work!
 * 
 * Proven: page.evaluate(fetch) from embed context → 206, about:blank → 403
 */

import puppeteer, { Browser, Page } from 'puppeteer';

interface StreamSession {
  m3u8Url: string;
  m3u8Content: string;
  timestamp: number;
  embedOrigin: string;
  page: Page;
  busy: boolean;   // Prevent concurrent page.evaluate calls
}

const sessions = new Map<string, StreamSession>();
const SESSION_TTL = 15 * 60 * 1000; // 15 minutes

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  console.log('[RebahinStream] Launching Puppeteer browser...');
  browserInstance = await puppeteer.launch({
    headless: 'new' as any,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  return browserInstance;
}

function getSessionKey(embedUrl: string): string {
  return embedUrl.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);
}

/**
 * Get or create a session for an embed URL.
 * The session keeps the embed page alive for segment proxying.
 */
async function getOrCreateSession(embedUrl: string): Promise<StreamSession | null> {
  const key = getSessionKey(embedUrl);
  const existing = sessions.get(key);
  
  if (existing && !existing.page.isClosed() && Date.now() - existing.timestamp < SESSION_TTL) {
    return existing;
  }
  
  // Clean up old session
  if (existing) {
    existing.page.close().catch(() => {});
    sessions.delete(key);
  }

  console.log('[RebahinStream] Creating session:', embedUrl.substring(0, 60));

  const browser = await getBrowser();
  const page = await browser.newPage();
  
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  let m3u8Content: string | null = null;
  let m3u8Url: string | null = null;
  let embedOrigin = '';

  try {
    const parsed = new URL(embedUrl);
    embedOrigin = parsed.origin;
  } catch {}

  // Intercept responses to capture m3u8
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();

    if (url.includes('groovy.monster') && url.includes('/stream/') && status === 200 && !m3u8Content) {
      try {
        const body = await response.text();
        if (body.includes('#EXTM3U')) {
          m3u8Content = body;
          m3u8Url = url;
          console.log('[RebahinStream] m3u8 captured! Length:', body.length);
        }
      } catch (e: any) {
        console.log('[RebahinStream] Could not read m3u8 response:', e.message);
      }
    }
  });

  // Navigate to the embed page
  try {
    await page.goto(embedUrl, {
      referer: 'https://rebahinxxi3.work/',
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
  } catch (e: any) {
    console.error('[RebahinStream] Navigation error:', e.message);
    await page.close().catch(() => {});
    return null;
  }

  // Wait for m3u8
  const startWait = Date.now();
  while (!m3u8Content && Date.now() - startWait < 15000) {
    await new Promise((r) => setTimeout(r, 500));
  }

  // Try clicking play button if m3u8 not captured yet
  if (!m3u8Content) {
    try {
      // Try multiple selectors for different JWPlayer versions
      const playSelectors = [
        '.jw-icon-display',
        '.jw-display-icon-container', 
        '.jw-video',
        'video',
        '.jw-controls .jw-icon-playback',
        '.jw-poster',
        '.play-button',
        '#player',
      ];
      
      for (const selector of playSelectors) {
        try {
          await page.click(selector);
          console.log(`[RebahinStream] Clicked ${selector}`);
          break;
        } catch {}
      }
      
      const retryStart = Date.now();
      while (!m3u8Content && Date.now() - retryStart < 10000) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {}
  }

  if (!m3u8Content || !m3u8Url) {
    console.error('[RebahinStream] Could not extract m3u8');
    await page.close().catch(() => {});
    return null;
  }

  // DON'T close the page! Keep it alive for segment fetches via page.evaluate
  const session: StreamSession = {
    m3u8Url,
    m3u8Content,
    timestamp: Date.now(),
    embedOrigin,
    page,
    busy: false,
  };

  sessions.set(key, session);
  console.log('[RebahinStream] Session created, page kept alive for segment proxying');
  return session;
}

/**
 * Find any active session that can be used for fetching
 */
function findActiveSession(): StreamSession | null {
  for (const [key, session] of sessions) {
    if (!session.page.isClosed() && Date.now() - session.timestamp < SESSION_TTL) {
      return session;
    }
    // Clean up dead sessions
    if (session.page.isClosed()) {
      sessions.delete(key);
    }
  }
  return null;
}

/**
 * Extract the m3u8 stream URL from a Rebahin embed page.
 */
export async function extractStream(
  embedUrl: string,
  proxyBaseUrl: string
): Promise<{ m3u8Content: string; m3u8Url: string } | null> {
  const session = await getOrCreateSession(embedUrl);
  if (!session) return null;

  const rewrittenContent = rewriteM3u8(session.m3u8Content, proxyBaseUrl);
  return { m3u8Content: rewrittenContent, m3u8Url: session.m3u8Url };
}

/**
 * Invalidate (destroy) a session so the next extractStream call creates a fresh one.
 */
export function invalidateSession(embedUrl: string): void {
  const key = getSessionKey(embedUrl);
  const existing = sessions.get(key);
  if (existing) {
    console.log('[RebahinStream] Invalidating session:', key);
    existing.page.close().catch(() => {});
    sessions.delete(key);
  }
}

/**
 * Fetch a stream segment using page.evaluate(fetch) on the embed page.
 * 
 * This is the KEY performance trick:
 * - The embed page already has the right origin context + cookies
 * - page.evaluate reuses the existing page (no tab creation/destruction)
 * - fetch() from the embed context gets 206 OK (proven by testing)
 * - Each call is just a JS function execution, ~200-500ms per segment
 */
export async function fetchStreamResource(
  url: string,
  rangeHeader?: string
): Promise<{ status: number; contentType: string; data: Buffer; headers: Record<string, string> } | null> {
  const session = findActiveSession();
  
  if (!session) {
    console.error('[RebahinStream] No active session for segment fetch');
    return null;
  }

  // Wait if page is busy with another fetch (prevent concurrent evaluate calls)
  let waitCount = 0;
  while (session.busy && waitCount < 100) {
    await new Promise(r => setTimeout(r, 50));
    waitCount++;
  }
  
  session.busy = true;

  try {
    const result = await session.page.evaluate(
      async (targetUrl: string, range: string | undefined) => {
        const headers: Record<string, string> = {};
        if (range) {
          headers['Range'] = range;
        }

        try {
          const resp = await fetch(targetUrl, { headers });
          const arrayBuffer = await resp.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Chunked base64 encoding to handle large segments without stack overflow
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);

          const respHeaders: Record<string, string> = {};
          resp.headers.forEach((value, key) => {
            respHeaders[key] = value;
          });

          return {
            status: resp.status,
            contentType: resp.headers.get('content-type') || 'video/mp2t',
            data: base64,
            headers: respHeaders,
          };
        } catch (e: any) {
          return { error: e.message };
        }
      },
      url,
      rangeHeader
    ) as any;

    if (result.error) {
      console.error('[RebahinStream] Segment fetch error:', result.error);
      return null;
    }

    return {
      status: result.status,
      contentType: result.contentType,
      data: Buffer.from(result.data, 'base64'),
      headers: result.headers,
    };
  } catch (err: any) {
    console.error('[RebahinStream] page.evaluate error:', err.message);
    // If the page crashed, mark it for cleanup
    if (err.message.includes('destroyed') || err.message.includes('closed') || err.message.includes('detached')) {
      const key = getSessionKey(session.m3u8Url);
      sessions.delete(key);
    }
    return null;
  } finally {
    session.busy = false;
  }
}

/**
 * Rewrite m3u8 content to route segment URLs through our proxy.
 */
function rewriteM3u8(content: string, proxyBaseUrl: string): string {
  return content.replace(
    /^(https?:\/\/[^\s]+)$/gm,
    (match: string) => {
      return `${proxyBaseUrl}?url=${encodeURIComponent(match)}`;
    }
  );
}

/**
 * Clean up expired sessions
 */
function cleanupSessions(): void {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.timestamp > SESSION_TTL || session.page.isClosed()) {
      console.log('[RebahinStream] Closing expired session:', key);
      session.page.close().catch(() => {});
      sessions.delete(key);
    }
  }
}

setInterval(cleanupSessions, 5 * 60 * 1000);
