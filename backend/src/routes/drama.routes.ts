import { Router, Request, Response } from 'express';
import axios from 'axios';
import convert from 'heic-convert';
import * as melolo from '../services/melolo';
import * as dramadash from '../services/dramadash';

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

export default router;
