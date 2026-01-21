import { Router, Request, Response } from 'express';
import axios from 'axios';
import convert from 'heic-convert';
import * as melolo from '../services/melolo';
import * as dramabox from '../services/dramabox';

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
      timeout: 30000, // Longer timeout for larger images
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://melolo.tv/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    const contentType = response.headers['content-type'] || '';
    const imageBuffer = Buffer.from(response.data);

    // Check if HEIC format (browsers don't support it)
    const isHeic = contentType.includes('heic') || contentType.includes('heif') || url.includes('.heic');

    if (isHeic) {
      // Convert HEIC to JPEG using heic-convert
      const jpegBuffer = await convert({
        buffer: imageBuffer,
        format: 'JPEG',
        quality: 0.85
      });

      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(jpegBuffer));
    } else {
      // Return as-is for other formats
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
 * Proxy video streams from DramaBox CDN to bypass CORS policy
 * Supports range requests for video seeking
 */
router.get('/video', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'URL parameter is required' });
      return;
    }

    // Validate it's a valid DramaBox video URL
    if (!url.includes('dramaboxdb.com')) {
      res.status(400).json({ success: false, error: 'Invalid video URL' });
      return;
    }

    // Get range header for video seeking
    const range = req.headers.range;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Don't compress video
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

    // Forward headers
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

    // Pipe the video stream
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying video:', error);
    res.status(500).json({ success: false, error: 'Failed to proxy video' });
  }
});

// ============================================================
// MELOLO API ENDPOINTS
// ============================================================

/**
 * GET /api/drama/latest
 * Get latest dramas from Melolo
 */
router.get('/latest', async (_req: Request, res: Response) => {
  try {
    const dramas = await melolo.getLatest();
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error fetching latest dramas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch latest dramas' });
  }
});

/**
 * GET /api/drama/trending
 * Get trending dramas from Melolo
 */
router.get('/trending', async (_req: Request, res: Response) => {
  try {
    const dramas = await melolo.getTrending();
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error fetching trending dramas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending dramas' });
  }
});

/**
 * GET /api/drama/search
 * Search dramas from Melolo
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }

    const dramas = await melolo.search(q, limit ? parseInt(limit as string) : 20);
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error searching dramas:', error);
    res.status(500).json({ success: false, error: 'Failed to search dramas' });
  }
});

/**
 * GET /api/drama/detail/:id
 * Get drama detail with episodes from Melolo
 */
router.get('/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const drama = await melolo.getDetail(id);

    if (!drama) {
      res.status(404).json({ success: false, error: 'Drama not found' });
      return;
    }

    res.json({
      success: true,
      data: drama,
    });
  } catch (error) {
    console.error('Error fetching drama detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drama detail' });
  }
});

/**
 * GET /api/drama/stream/:vid
 * Get video stream URL from Melolo
 */
router.get('/stream/:vid', async (req: Request, res: Response) => {
  try {
    const { vid } = req.params;
    const streamUrl = await melolo.getStream(vid);

    if (!streamUrl) {
      res.status(404).json({ success: false, error: 'Stream not found' });
      return;
    }

    res.json({
      success: true,
      data: { url: streamUrl },
    });
  } catch (error) {
    console.error('Error fetching stream:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stream' });
  }
});

// ============================================================
// DRAMABOX API ENDPOINTS
// ============================================================

/**
 * GET /api/drama/dramabox/latest
 * Get latest dramas from DramaBox
 */
router.get('/dramabox/latest', async (_req: Request, res: Response) => {
  try {
    const dramas = await dramabox.getLatest();
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error fetching DramaBox latest:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch latest dramas' });
  }
});

/**
 * GET /api/drama/dramabox/trending
 * Get trending dramas from DramaBox
 */
router.get('/dramabox/trending', async (_req: Request, res: Response) => {
  try {
    const dramas = await dramabox.getTrending();
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error fetching DramaBox trending:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending dramas' });
  }
});

/**
 * GET /api/drama/dramabox/dubbed
 * Get dubbed dramas from DramaBox with pagination
 */
router.get('/dramabox/dubbed', async (req: Request, res: Response) => {
  try {
    const classify = (req.query.classify as 'terpopuler' | 'terbaru') || 'terpopuler';
    const page = parseInt(req.query.page as string) || 1;
    const dramas = await dramabox.getDubbed(classify, page);
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error fetching DramaBox dubbed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dubbed dramas' });
  }
});

/**
 * GET /api/drama/dramabox/for-you
 * Get recommended dramas from DramaBox
 */
router.get('/dramabox/for-you', async (_req: Request, res: Response) => {
  try {
    const dramas = await dramabox.getForYou();
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error fetching DramaBox for-you:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
  }
});

/**
 * GET /api/drama/dramabox/search
 * Search dramas from DramaBox
 */
router.get('/dramabox/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }

    const dramas = await dramabox.search(q);
    res.json({
      success: true,
      data: dramas,
    });
  } catch (error) {
    console.error('Error searching DramaBox:', error);
    res.status(500).json({ success: false, error: 'Failed to search dramas' });
  }
});

/**
 * GET /api/drama/dramabox/detail/:id
 * Get drama detail from DramaBox
 */
router.get('/dramabox/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const drama = await dramabox.getDetail(id);

    if (!drama) {
      res.status(404).json({ success: false, error: 'Drama not found' });
      return;
    }

    res.json({
      success: true,
      data: drama,
    });
  } catch (error) {
    console.error('Error fetching DramaBox detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drama detail' });
  }
});

/**
 * GET /api/drama/dramabox/episodes/:id
 * Get episodes with streaming URLs from DramaBox
 */
router.get('/dramabox/episodes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const episodes = await dramabox.getEpisodes(id);

    res.json({
      success: true,
      data: episodes,
    });
  } catch (error) {
    console.error('Error fetching DramaBox episodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
  }
});

export default router;

