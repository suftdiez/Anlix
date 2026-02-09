import { Router, Request, Response } from 'express';
import { samehadaku, otakudesu, kuramanime } from '../scrapers';

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

export default router;
