import { Router, Request, Response } from 'express';
import { samehadaku, otakudesu, kuramanime, subnime, kusonime } from '../scrapers';

const router = Router();

/**
 * GET /api/anime/latest
 * Get latest anime updates
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await samehadaku.getLatestAnime(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching latest anime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/ongoing
 * Get ongoing anime
 */
router.get('/ongoing', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await samehadaku.getOngoingAnime(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching ongoing anime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/completed
 * Get completed anime
 */
router.get('/completed', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await otakudesu.getCompleteAnime(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching completed anime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/search
 * Search anime
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    
    if (!query) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    const result = await samehadaku.searchAnime(query, page);
    
    res.json({
      success: true,
      query,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error searching anime:', error);
    res.status(500).json({ success: false, error: 'Failed to search anime' });
  }
});

/**
 * GET /api/anime/genre/:genre
 * Get anime by genre
 */
router.get('/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await samehadaku.getAnimeByGenre(genre, page);
    
    res.json({
      success: true,
      genre,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching anime by genre:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/detail/:slug
 * Get anime detail
 */
router.get('/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await samehadaku.getAnimeDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Anime not found' });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching anime detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime detail' });
  }
});

/**
 * GET /api/anime/episode/:slug
 * Get episode streaming data
 */
router.get('/episode/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await samehadaku.getEpisodeDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Episode not found' });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching episode:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episode' });
  }
});

/**
 * POST /api/anime/stream
 * Get video stream URL from AJAX-based server
 */
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const { post, nume, type } = req.body;
    
    if (!post || !nume) {
      res.status(400).json({ success: false, error: 'Missing post or nume parameter' });
      return;
    }

    const streamUrl = await samehadaku.getServerStream(post, nume, type || 'video');
    
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

// ============================================
// SCHEDULE ROUTE
// ============================================

/**
 * GET /api/anime/schedule
 * Get anime release schedule (per day)
 */
router.get('/schedule', async (req: Request, res: Response) => {
  try {
    const schedule = await otakudesu.getSchedule();
    
    res.json({
      success: true,
      source: 'otakudesu',
      data: schedule,
    });
  } catch (error) {
    console.error('Error fetching anime schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedule' });
  }
});

// ============================================
// OTAKUDESU ROUTES - Alternative anime source
// ============================================

/**
 * GET /api/anime/otakudesu/latest
 * Get latest anime from Otakudesu
 */
router.get('/otakudesu/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await otakudesu.getLatestAnime(page);
    
    res.json({
      success: true,
      source: 'otakudesu',
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching latest anime from otakudesu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/otakudesu/complete
 * Get completed anime from Otakudesu
 */
router.get('/otakudesu/complete', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await otakudesu.getCompleteAnime(page);
    
    res.json({
      success: true,
      source: 'otakudesu',
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching complete anime from otakudesu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/otakudesu/search
 * Search anime on Otakudesu
 */
router.get('/otakudesu/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    
    if (!query) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    const result = await otakudesu.searchAnime(query, page);
    
    res.json({
      success: true,
      source: 'otakudesu',
      query,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error searching anime on otakudesu:', error);
    res.status(500).json({ success: false, error: 'Failed to search anime' });
  }
});

/**
 * GET /api/anime/otakudesu/genre/:genre
 * Get anime by genre from Otakudesu
 */
router.get('/otakudesu/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await otakudesu.getAnimeByGenre(genre, page);
    
    res.json({
      success: true,
      source: 'otakudesu',
      genre,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching anime by genre from otakudesu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/otakudesu/detail/:slug
 * Get anime detail from Otakudesu
 */
router.get('/otakudesu/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await otakudesu.getAnimeDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Anime not found' });
      return;
    }

    res.json({
      success: true,
      source: 'otakudesu',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching anime detail from otakudesu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime detail' });
  }
});

/**
 * GET /api/anime/otakudesu/episode/:slug
 * Get episode streaming data from Otakudesu
 */
router.get('/otakudesu/episode/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await otakudesu.getEpisodeDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Episode not found' });
      return;
    }

    res.json({
      success: true,
      source: 'otakudesu',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching episode from otakudesu:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episode' });
  }
});

// ============================================
// KURAMANIME ROUTES - Third anime source
// ============================================

/**
 * GET /api/anime/kuramanime/latest
 * Get latest/ongoing anime from Kuramanime
 */
router.get('/kuramanime/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await kuramanime.getLatestAnime(page);
    
    res.json({
      success: true,
      source: 'kuramanime',
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching latest anime from kuramanime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/kuramanime/complete
 * Get completed anime from Kuramanime
 */
router.get('/kuramanime/complete', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await kuramanime.getCompleteAnime(page);
    
    res.json({
      success: true,
      source: 'kuramanime',
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching completed anime from kuramanime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/kuramanime/search
 * Search anime from Kuramanime
 */
router.get('/kuramanime/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    
    if (!query) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    const result = await kuramanime.searchAnime(query, page);
    
    res.json({
      success: true,
      source: 'kuramanime',
      query,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error searching kuramanime:', error);
    res.status(500).json({ success: false, error: 'Failed to search anime' });
  }
});

/**
 * GET /api/anime/kuramanime/genre/:genre
 * Get anime by genre from Kuramanime
 */
router.get('/kuramanime/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const result = await kuramanime.getAnimeByGenre(genre, page);
    
    res.json({
      success: true,
      source: 'kuramanime',
      genre,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching anime by genre from kuramanime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/kuramanime/detail/:id/:slug
 * Get anime detail from Kuramanime using id/slug format
 */
router.get('/kuramanime/detail/:id/:slug', async (req: Request, res: Response) => {
  try {
    const { id, slug } = req.params;
    const fullId = `${id}/${slug}`;
    const result = await kuramanime.getAnimeDetail(fullId);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Anime not found' });
      return;
    }

    res.json({
      success: true,
      source: 'kuramanime',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching anime detail from kuramanime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime detail' });
  }
});

/**
 * GET /api/anime/kuramanime/detail/:id
 * Get anime detail from Kuramanime (numeric id only - fallback)
 */
router.get('/kuramanime/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await kuramanime.getAnimeDetail(id);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Anime not found' });
      return;
    }

    res.json({
      success: true,
      source: 'kuramanime',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching anime detail from kuramanime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime detail' });
  }
});

/**
 * GET /api/anime/kuramanime/episode/:animeId/:episode
 * Get episode streaming data from Kuramanime
 */
router.get('/kuramanime/episode/:animeId/:episode', async (req: Request, res: Response) => {
  try {
    const { animeId, episode } = req.params;
    const result = await kuramanime.getEpisodeDetail(animeId, episode);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Episode not found' });
      return;
    }

    res.json({
      success: true,
      source: 'kuramanime',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching episode from kuramanime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episode' });
  }
});

// ============================================
// SUBNIME ROUTES - Fourth anime source (search-only supplement)
// ============================================

/**
 * GET /api/anime/subnime/search
 * Search anime on Subnime
 */
router.get('/subnime/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    
    if (!query) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    const result = await subnime.searchAnime(query, page);
    
    res.json({
      success: true,
      source: 'subnime',
      query,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error searching anime on subnime:', error);
    res.status(500).json({ success: false, error: 'Failed to search anime' });
  }
});

/**
 * GET /api/anime/subnime/detail/:slug
 * Get anime detail from Subnime
 */
router.get('/subnime/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await subnime.getAnimeDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Anime not found' });
      return;
    }

    res.json({
      success: true,
      source: 'subnime',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching anime detail from subnime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime detail' });
  }
});

/**
 * GET /api/anime/subnime/episode/:slug
 * Get episode streaming data from Subnime
 */
router.get('/subnime/episode/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await subnime.getEpisodeDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Episode not found' });
      return;
    }

    res.json({
      success: true,
      source: 'subnime',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching episode from subnime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episode' });
  }
});

/**
 * GET /api/anime/subnime/genre/:genre
 * Get anime by genre from Subnime
 */
router.get('/subnime/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const result = await subnime.getAnimeByGenre(genre, page);
    
    res.json({
      success: true,
      source: 'subnime',
      genre,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching anime by genre from subnime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

/**
 * GET /api/anime/subnime/proxy
 * Proxy for Subnime embed player URLs (bypasses Referer check)
 */
router.get('/subnime/proxy', async (req: Request, res: Response) => {
  try {
    const embedUrl = req.query.url as string;
    if (!embedUrl) {
      res.status(400).json({ success: false, error: 'Missing url parameter' });
      return;
    }

    // Only allow proxying from known embed domains
    const allowedDomains = ['subcrp.site', 'player.subnime.com', 'embed.subnime.com'];
    let urlObj: URL;
    try {
      urlObj = new URL(embedUrl);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid URL' });
      return;
    }
    
    if (!allowedDomains.some(d => urlObj.hostname.includes(d))) {
      res.status(403).json({ success: false, error: 'Domain not allowed for proxy' });
      return;
    }

    const axios = require('axios');
    const response = await axios.get(embedUrl, {
      headers: {
        'Referer': 'https://subnime.com/',
        'Origin': 'https://subnime.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      responseType: 'text',
      timeout: 15000,
    });

    // Inject <base> tag so relative URLs (scripts, video streams) resolve to the original domain
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    let html = response.data as string;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head><base href="${baseUrl}/">`);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', `<HEAD><base href="${baseUrl}/">`);
    } else {
      // Prepend base tag if no head tag found
      html = `<base href="${baseUrl}/">` + html;
    }

    // Override helmet's CSP headers for this proxy route
    // - Remove Content-Security-Policy to allow base-uri and frame-ancestors from any origin
    // - Set permissive X-Frame-Options to allow embedding in frontend iframe
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
  } catch (error) {
    console.error('Error proxying subnime embed:', error);
    res.status(500).json({ success: false, error: 'Failed to proxy embed' });
  }
});

// ============================================
// KUSONIME ROUTES - Batch download source
// ============================================

/**
 * GET /api/anime/kusonime/batch/:title
 * Get batch download links from Kusonime by anime title
 */
router.get('/kusonime/batch/:title', async (req: Request, res: Response) => {
  try {
    const { title } = req.params;
    const result = await kusonime.findBatchDownloads(decodeURIComponent(title));
    
    if (!result) {
      res.json({
        success: true,
        source: 'kusonime',
        data: null,
      });
      return;
    }

    res.json({
      success: true,
      source: 'kusonime',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching batch downloads from kusonime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch batch downloads' });
  }
});

/**
 * GET /api/anime/kusonime/search
 * Search anime on Kusonime
 */
router.get('/kusonime/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter q is required' });
      return;
    }

    const results = await kusonime.searchAnime(query);
    
    res.json({
      success: true,
      source: 'kusonime',
      data: results,
    });
  } catch (error) {
    console.error('Error searching kusonime:', error);
    res.status(500).json({ success: false, error: 'Failed to search kusonime' });
  }
});

export default router;
