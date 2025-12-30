import { Router, Request, Response } from 'express';
import { samehadaku } from '../scrapers';

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

export default router;
