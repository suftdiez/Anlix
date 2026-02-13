import { Router, Request, Response } from 'express';
import axios from 'axios';
import convert from 'heic-convert';
import * as melolo from '../services/melolo';
import * as dramadash from '../services/dramadash';
import * as dramaboxSansekai from '../services/dramabox-sansekai';
import * as rebahin from '../scrapers/rebahin';

const router = Router();

/**
 * GET /api/drama/image
 * Proxy images from Melolo CDN to bypass hotlinking protection
 * Also converts HEIC to JPEG since browsers don't support HEIC
 */
router.get('/image', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'URL parameter is required' });
      return;
    }

    // Fetch image with proper headers to bypass hotlinking protection
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://melolo.tv/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    const contentType = response.headers['content-type'] || '';
    const imageBuffer = Buffer.from(response.data);

    const isHeic = contentType.includes('heic') || contentType.includes('heif') || url.includes('.heic');

    if (isHeic) {
      const jpegBuffer = await convert({
        buffer: imageBuffer,
        format: 'JPEG',
        quality: 0.85
      });

      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(jpegBuffer));
    } else {
      res.set('Content-Type', contentType || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(imageBuffer);
    }
  } catch (error) {
    console.error('Error proxying image:', error);
    res.status(500).json({ success: false, error: 'Failed to proxy image' });
  }
});

/**
 * GET /api/drama/video
 * Proxy video streams to bypass CORS policy
 */
router.get('/video', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'URL parameter is required' });
      return;
    }

    const range = req.headers.range;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
    };

    if (range) {
      headers['Range'] = range;
    }

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000,
      headers,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    res.status(response.status);
    res.set('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.set('Accept-Ranges', 'bytes');
    res.set('Access-Control-Allow-Origin', '*');
    
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      res.set('Content-Range', response.headers['content-range']);
    }

    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying video:', error);
    res.status(500).json({ success: false, error: 'Failed to proxy video' });
  }
});

// ============================================================
// MELOLO API ENDPOINTS
// ============================================================

router.get('/latest', async (_req: Request, res: Response) => {
  try {
    const dramas = await melolo.getLatest();
    res.json({ success: true, data: dramas });
  } catch (error) {
    console.error('Error fetching latest dramas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch latest dramas' });
  }
});

router.get('/trending', async (_req: Request, res: Response) => {
  try {
    const dramas = await melolo.getTrending();
    res.json({ success: true, data: dramas });
  } catch (error) {
    console.error('Error fetching trending dramas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending dramas' });
  }
});

router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }
    const dramas = await melolo.search(q, limit ? parseInt(limit as string) : 20);
    res.json({ success: true, data: dramas });
  } catch (error) {
    console.error('Error searching dramas:', error);
    res.status(500).json({ success: false, error: 'Failed to search dramas' });
  }
});

router.get('/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const drama = await melolo.getDetail(id);
    if (!drama) {
      res.status(404).json({ success: false, error: 'Drama not found' });
      return;
    }
    res.json({ success: true, data: drama });
  } catch (error) {
    console.error('Error fetching drama detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drama detail' });
  }
});

router.get('/stream/:vid', async (req: Request, res: Response) => {
  try {
    const { vid } = req.params;
    const streamUrl = await melolo.getStream(vid);
    if (!streamUrl) {
      res.status(404).json({ success: false, error: 'Stream not found' });
      return;
    }
    res.json({ success: true, data: { url: streamUrl } });
  } catch (error) {
    console.error('Error fetching stream:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stream' });
  }
});

// ============================================================
// DRAMADASH API ENDPOINTS (Replacement for DramaBox)
// ============================================================

/**
 * Transform DramaDash drama to standard format
 * New structure: { id, name, slug, description, poster, tags, genres[] }
 */
function transformDramaDashDrama(drama: any) {
  // Extract genre display names
  const categories = (drama.genres || []).map((g: any) => 
    typeof g === 'string' ? g : (g.displayName || g.name || '')
  ).filter(Boolean);

  return {
    id: drama.id?.toString() || '',
    title: drama.name || '',
    poster: drama.poster || '',
    abstract: drama.description || '',
    status: 'Unknown',
    episodeCount: drama.episodeCount || 0,
    categories: categories,
    playCount: drama.viewCount,
  };
}

/**
 * Extract dramas from DramaDash home response
 * Structure: { dramaList: [{ list: [...] }], bannerDramaList: [...] }
 */
function extractDramasFromHome(response: any): any[] {
  const dramas: any[] = [];
  
  // Extract from dramaList (array of categories, each with a list)
  if (response.dramaList && Array.isArray(response.dramaList)) {
    for (const category of response.dramaList) {
      if (category.list && Array.isArray(category.list)) {
        dramas.push(...category.list);
      }
    }
  }
  
  // Extract from bannerDramaList
  if (response.bannerDramaList && Array.isArray(response.bannerDramaList)) {
    dramas.push(...response.bannerDramaList);
  }
  
  return dramas;
}

/**
 * GET /api/drama/dramabox/latest
 * Get home dramas from DramaDash
 */
router.get('/dramabox/latest', async (_req: Request, res: Response) => {
  try {
    const response = await dramadash.getHome();
    const allDramas = extractDramasFromHome(response);
    const dramas = allDramas.map(transformDramaDashDrama);
    
    // Dedupe by id
    const uniqueDramas = Array.from(
      new Map(dramas.map(d => [d.id, d])).values()
    );
    
    console.log(`[DramaDash] Returning ${uniqueDramas.length} latest dramas`);
    res.json({ success: true, data: uniqueDramas });
  } catch (error) {
    console.error('Error fetching DramaDash latest:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch latest dramas' });
  }
});

/**
 * GET /api/drama/dramabox/trending
 * Get trending from DramaDash (uses trendingSearches or first category)
 */
router.get('/dramabox/trending', async (_req: Request, res: Response) => {
  try {
    const response = await dramadash.getHome();
    let dramas: any[] = [];
    
    // Try trendingSearches first, or use first dramaList category
    if (response.trendingSearches && Array.isArray(response.trendingSearches)) {
      dramas = response.trendingSearches.map(transformDramaDashDrama);
    } else if (response.dramaList?.[0]?.list) {
      dramas = response.dramaList[0].list.map(transformDramaDashDrama);
    }
    
    console.log(`[DramaDash] Returning ${dramas.length} trending dramas`);
    res.json({ success: true, data: dramas });
  } catch (error) {
    console.error('Error fetching DramaDash trending:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending dramas' });
  }
});

/**
 * GET /api/drama/dramabox/dubbed
 * Get dramas by tab (simulated pagination from home data)
 */
router.get('/dramabox/dubbed', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const response = await dramadash.getHome();
    const allDramas = extractDramasFromHome(response);
    const dramas = allDramas.map(transformDramaDashDrama);
    
    // Dedupe and paginate
    const uniqueDramas = Array.from(
      new Map(dramas.map(d => [d.id, d])).values()
    );
    
    const pageSize = 15;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedDramas = uniqueDramas.slice(start, end);
    
    console.log(`[DramaDash] Returning page ${page} with ${paginatedDramas.length} dubbed dramas`);
    res.json({ success: true, data: paginatedDramas });
  } catch (error) {
    console.error('Error fetching DramaDash dubbed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dubbed dramas' });
  }
});

/**
 * GET /api/drama/dramabox/for-you
 * Get recommendations (uses moreToExplore or second category)
 */
router.get('/dramabox/for-you', async (_req: Request, res: Response) => {
  try {
    const response = await dramadash.getHome();
    let dramas: any[] = [];
    
    if (response.moreToExplore && Array.isArray(response.moreToExplore)) {
      dramas = response.moreToExplore.map(transformDramaDashDrama);
    } else if (response.dramaList?.[1]?.list) {
      dramas = response.dramaList[1].list.map(transformDramaDashDrama);
    }
    
    console.log(`[DramaDash] Returning ${dramas.length} for-you dramas`);
    res.json({ success: true, data: dramas });
  } catch (error) {
    console.error('Error fetching DramaDash for-you:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
  }
});

/**
 * GET /api/drama/dramabox/search
 * Search dramas from DramaDash
 */
router.get('/dramabox/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }

    const response = await dramadash.searchDrama(q);
    // Search response structure may vary - handle both array and object with data
    let results: any[] = [];
    if (Array.isArray(response)) {
      results = response;
    } else if (response.data && Array.isArray(response.data)) {
      results = response.data;
    } else if (response.list && Array.isArray(response.list)) {
      results = response.list;
    }
    
    const dramas = results.map(transformDramaDashDrama);
    console.log(`[DramaDash] Search "${q}" returned ${dramas.length} results`);
    res.json({ success: true, data: dramas });
  } catch (error) {
    console.error('Error searching DramaDash:', error);
    res.status(500).json({ success: false, error: 'Failed to search dramas' });
  }
});

/**
 * GET /api/drama/dramabox/detail/:id
 * Get drama detail from DramaDash
 */
router.get('/dramabox/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await dramadash.getDrama(parseInt(id));

    // API returns { drama: { ... } } structure
    if (!response || !response.drama) {
      res.status(404).json({ success: false, error: 'Drama not found' });
      return;
    }

    const drama = response.drama;
    const categories = (drama.genres || []).map((g: any) => 
      typeof g === 'string' ? g : (g.displayName || g.name || '')
    ).filter(Boolean);

    res.json({
      success: true,
      data: {
        id: id,
        title: drama.name || '',
        poster: drama.poster || '',
        abstract: drama.description || '',
        status: 'Unknown',
        episodeCount: drama.episodes?.length || 0,
        categories: categories,
      },
    });
  } catch (error) {
    console.error('Error fetching DramaDash detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drama detail' });
  }
});

/**
 * GET /api/drama/dramabox/episodes/:id
 * Get episodes with streaming URLs from DramaDash
 */
router.get('/dramabox/episodes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await dramadash.getDrama(parseInt(id));

    // API returns { drama: { episodes: [...] } } structure
    if (!response || !response.drama?.episodes) {
      console.log(`[DramaDash] No episodes found for drama ${id}`);
      res.json({ success: true, data: [] });
      return;
    }

    const episodes = response.drama.episodes.map((ep: any) => ({
      id: ep.id?.toString() || '',
      index: ep.episodeNumber || 0,
      name: `Episode ${ep.episodeNumber}`,
      videoUrl: ep.videoUrl || '',
      quality: 720,
      isLocked: ep.isLocked || false,
      subtitles: ep.subtitles || [],
    }));

    console.log(`[DramaDash] Returning ${episodes.length} episodes for drama ${id}`);
    res.json({ success: true, data: episodes });
  } catch (error) {
    console.error('Error fetching DramaDash episodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
  }
});

// ============================================================
// DRAMABOX SANSEKAI API ENDPOINTS (Third Source)
// ============================================================

/**
 * GET /api/drama/dramabox-sansekai/latest
 * Get latest dramas from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/latest', async (_req: Request, res: Response) => {
  try {
    const result = await dramaboxSansekai.getLatest();
    console.log(`[DramaBox-Sansekai] Returning ${result.data?.length || 0} latest dramas`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching DramaBox-Sansekai latest:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch latest dramas' });
  }
});

/**
 * GET /api/drama/dramabox-sansekai/trending
 * Get trending dramas from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/trending', async (_req: Request, res: Response) => {
  try {
    const result = await dramaboxSansekai.getTrending();
    console.log(`[DramaBox-Sansekai] Returning ${result.data?.length || 0} trending dramas`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching DramaBox-Sansekai trending:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending dramas' });
  }
});

/**
 * GET /api/drama/dramabox-sansekai/dubindo
 * Get dubbed indo dramas from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/dubindo', async (req: Request, res: Response) => {
  try {
    const classify = (req.query.classify as string) || 'terpopuler';
    const page = parseInt(req.query.page as string) || 1;
    const result = await dramaboxSansekai.getDubindo(classify, page);
    console.log(`[DramaBox-Sansekai] Returning ${result.data?.length || 0} dubindo dramas (${classify}, page ${page})`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching DramaBox-Sansekai dubindo:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dubbed dramas' });
  }
});

/**
 * GET /api/drama/dramabox-sansekai/vip
 * Get VIP dramas from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/vip', async (_req: Request, res: Response) => {
  try {
    const result = await dramaboxSansekai.getVip();
    console.log(`[DramaBox-Sansekai] Returning ${result.data?.length || 0} VIP dramas`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching DramaBox-Sansekai VIP:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch VIP dramas' });
  }
});

/**
 * GET /api/drama/dramabox-sansekai/foryou
 * Get recommendations from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/foryou', async (_req: Request, res: Response) => {
  try {
    const result = await dramaboxSansekai.getForYou();
    console.log(`[DramaBox-Sansekai] Returning ${result.data?.length || 0} for-you dramas`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching DramaBox-Sansekai for-you:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
  }
});

/**
 * GET /api/drama/dramabox-sansekai/search
 * Search dramas from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }
    const result = await dramaboxSansekai.search(q);
    console.log(`[DramaBox-Sansekai] Search "${q}" returned ${result.data?.length || 0} results`);
    res.json(result);
  } catch (error) {
    console.error('Error searching DramaBox-Sansekai:', error);
    res.status(500).json({ success: false, error: 'Failed to search dramas' });
  }
});

/**
 * GET /api/drama/dramabox-sansekai/detail/:id
 * Get drama detail from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await dramaboxSansekai.getDetail(id);
    if (!result.success || !result.data) {
      res.status(404).json({ success: false, error: 'Drama not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching DramaBox-Sansekai detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drama detail' });
  }
});

/**
 * GET /api/drama/dramabox-sansekai/episodes/:id
 * Get episodes from DramaBox Sansekai
 */
router.get('/dramabox-sansekai/episodes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await dramaboxSansekai.getEpisodes(id);
    console.log(`[DramaBox-Sansekai] Returning ${result.data?.length || 0} episodes for drama ${id}`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching DramaBox-Sansekai episodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
  }
});

// ============================================================
// REBAHIN API ENDPOINTS (Chinese Drama Source)
// ============================================================

/**
 * GET /api/drama/rebahin/latest
 * Get Chinese drama listing from Rebahin
 */
router.get('/rebahin/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await rebahin.getDramaChinaList(page);
    console.log(`[Rebahin] Returning ${result.data.length} dramas (page ${page})`);
    res.json({ success: true, data: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching Rebahin latest:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Chinese dramas' });
  }
});

/**
 * GET /api/drama/rebahin/detail/:slug
 * Get drama detail from Rebahin
 */
router.get('/rebahin/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const detail = await rebahin.getDramaDetail(slug);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Drama not found' });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (error) {
    console.error('Error fetching Rebahin detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drama detail' });
  }
});

/**
 * GET /api/drama/rebahin/episodes/:slug
 * Get episodes with streaming URLs from Rebahin
 */
router.get('/rebahin/episodes/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await rebahin.getDramaEpisodes(slug);
    if (!result) {
      res.json({ success: true, data: { title: '', episodes: [] } });
      return;
    }
    console.log(`[Rebahin] Returning ${result.episodes.length} episodes for ${slug}`);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching Rebahin episodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
  }
});

/**
 * GET /api/drama/rebahin/search
 * Search dramas on Rebahin
 */
router.get('/rebahin/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }
    const results = await rebahin.searchDrama(q);
    console.log(`[Rebahin] Search "${q}" returned ${results.length} results`);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching Rebahin:', error);
    res.status(500).json({ success: false, error: 'Failed to search dramas' });
  }
});

/**
 * GET /api/drama/rebahin/stream
 * Extract actual video stream URL from an embed page by decoding JuicyCodes
 * Query: ?url=<base64-encoded-embed-url>
 */
router.get('/rebahin/stream', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'URL parameter is required' });
      return;
    }

    // Decode the URL (passed as base64)
    let embedUrl: string;
    try {
      embedUrl = Buffer.from(url, 'base64').toString('utf-8');
    } catch {
      embedUrl = url;
    }

    const streamInfo = await rebahin.getStreamUrl(embedUrl);
    if (!streamInfo) {
      res.status(404).json({ success: false, error: 'Could not extract stream URL' });
      return;
    }

    res.json({ success: true, data: streamInfo });
  } catch (error) {
    console.error('Error extracting stream:', error);
    res.status(500).json({ success: false, error: 'Failed to extract stream' });
  }
});

/**
/**
 * GET /api/drama/rebahin/embed
 * Serve an HLS video player that loads stream from our Puppeteer-based extraction endpoint.
 * The stream is extracted using a real Chrome browser (Puppeteer) to bypass TLS fingerprint validation.
 * Query: ?url=<base64-encoded-embed-url>
 */
router.get('/rebahin/embed', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'URL parameter is required' });
      return;
    }

    // Build the stream URL that will trigger Puppeteer extraction
    const streamEndpoint = `${req.protocol}://${req.get('host')}/api/drama/rebahin/hls-stream?url=${encodeURIComponent(url)}`;

    // Serve a minimal HTML page with HLS.js video player
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading...</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    video { width: 100%; height: 100%; object-fit: contain; }
    .loading { display: flex; align-items: center; justify-content: center; 
               height: 100%; color: #999; font-family: system-ui; font-size: 16px; }
    .loading .spinner { width: 32px; height: 32px; border: 3px solid #333; 
                        border-top-color: #14b8a6; border-radius: 50%; 
                        animation: spin 0.8s linear infinite; margin-right: 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error { color: #ef4444; text-align: center; padding: 20px; font-family: system-ui; }
  </style>
</head>
<body>
  <div id="loading" class="loading">
    <div class="spinner"></div>
    <span>Memuat stream...</span>
  </div>
  <video id="video" controls style="display:none"></video>
  <div id="error" class="error" style="display:none"></div>
  <script>
    (function() {
      var video = document.getElementById('video');
      var loading = document.getElementById('loading');
      var errorDiv = document.getElementById('error');
      var streamUrl = ${JSON.stringify(streamEndpoint)};
      
      function showError(msg) {
        loading.style.display = 'none';
        errorDiv.style.display = 'flex';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.justifyContent = 'center';
        errorDiv.style.height = '100%';
        errorDiv.textContent = msg;
      }
      
      function loadStream() {
        if (Hls.isSupported()) {
          var hls = new Hls({
            debug: false,
            enableWorker: true,
            xhrSetup: function(xhr) {
              xhr.withCredentials = false;
            }
          });
          
          hls.on(Hls.Events.MANIFEST_PARSED, function() {
            loading.style.display = 'none';
            video.style.display = 'block';
            video.play().catch(function() {});
          });
          
          hls.on(Hls.Events.ERROR, function(event, data) {
            console.error('HLS error:', data);
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                showError('Gagal memuat stream. Coba refresh halaman.');
              } else {
                showError('Error: ' + (data.details || 'Unknown error'));
              }
            }
          });
          
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          video.src = streamUrl;
          video.addEventListener('loadedmetadata', function() {
            loading.style.display = 'none';
            video.style.display = 'block';
            video.play().catch(function() {});
          });
        } else {
          showError('Browser tidak mendukung HLS playback');
        }
      }
      
      loadStream();
    })();
  </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-cache');
    res.send(html);
  } catch (error: any) {
    console.error('Error serving embed page:', error.message);
    res.status(500).json({ success: false, error: 'Failed to serve embed page' });
  }
});

/**
 * GET /api/drama/rebahin/hls-stream
 * Extract and serve the m3u8 playlist using Puppeteer.
 * Segment URLs are rewritten to go through /stream-proxy.
 * Query: ?url=<base64-encoded-embed-url>
 */
router.get('/rebahin/hls-stream', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'URL parameter is required' });
      return;
    }

    // Decode the URL (passed as base64)
    let embedUrl: string;
    try {
      embedUrl = Buffer.from(url, 'base64').toString('utf-8');
    } catch {
      embedUrl = url;
    }

    const proxyBaseUrl = `${req.protocol}://${req.get('host')}/api/drama/rebahin/stream-proxy`;

    // Import dynamically to avoid circular deps and load issues
    const { extractStream } = require('../services/rebahinStream');
    const result = await extractStream(embedUrl, proxyBaseUrl);

    if (!result) {
      res.status(502).json({ success: false, error: 'Failed to extract stream' });
      return;
    }

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Cache-Control', 'no-cache');
    res.send(result.m3u8Content);
  } catch (error: any) {
    console.error('Error extracting stream:', error.message);
    res.status(500).json({ success: false, error: 'Stream extraction failed' });
  }
});

/**
 * GET /api/drama/rebahin/stream-proxy
 * Proxy stream segment/resource requests through Puppeteer's Chrome browser.
 * This is needed because the CDN validates TLS fingerprints (JA3/JA4).
 * Query: ?url=<target-url>
 */
router.get('/rebahin/stream-proxy', async (req: Request, res: Response) => {
  try {
    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', '*');
      res.set('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }

    const rangeHeader = req.headers.range;
    
    const { fetchStreamResource } = require('../services/rebahinStream');
    const result = await fetchStreamResource(targetUrl, rangeHeader);

    if (!result) {
      res.status(502).send('Failed to fetch stream resource');
      return;
    }

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Expose-Headers', '*');
    
    // Forward relevant headers from the upstream response
    if (result.headers['content-type']) {
      res.set('Content-Type', result.headers['content-type']);
    }
    if (result.headers['content-range']) {
      res.set('Content-Range', result.headers['content-range']);
    }
    if (result.headers['content-length']) {
      res.set('Content-Length', result.headers['content-length']);
    }
    res.set('Accept-Ranges', 'bytes');

    res.status(result.status).send(result.data);
  } catch (error: any) {
    console.error('Stream proxy error:', error.message);
    res.status(502).send('Proxy error');
  }
});

/**
 * GET /api/drama/rebahin/cors-proxy (kept for backwards compatibility)
 * Now redirects to stream-proxy
 */
router.all('/rebahin/cors-proxy', async (req: Request, res: Response) => {
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.set('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  // Forward to stream-proxy
  res.redirect(`/api/drama/rebahin/stream-proxy?url=${encodeURIComponent(targetUrl)}`);
});

export default router;


