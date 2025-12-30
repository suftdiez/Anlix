import { Router, Request, Response } from 'express';
import { anichin } from '../scrapers';

const router = Router();

/**
 * GET /api/donghua/latest
 * Get latest donghua updates
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await anichin.getLatestDonghua(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching latest donghua:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donghua' });
  }
});

/**
 * GET /api/donghua/ongoing
 * Get ongoing donghua
 */
router.get('/ongoing', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await anichin.getOngoingDonghua(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching ongoing donghua:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donghua' });
  }
});

/**
 * GET /api/donghua/popular
 * Get popular donghua
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const result = await anichin.getPopularDonghua();
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching popular donghua:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donghua' });
  }
});

/**
 * GET /api/donghua/search
 * Search donghua
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    
    if (!query) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    const result = await anichin.searchDonghua(query, page);
    
    res.json({
      success: true,
      query,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error searching donghua:', error);
    res.status(500).json({ success: false, error: 'Failed to search donghua' });
  }
});

/**
 * GET /api/donghua/genre/:genre
 * Get donghua by genre
 */
router.get('/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await anichin.getDonghuaByGenre(genre, page);
    
    res.json({
      success: true,
      genre,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching donghua by genre:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donghua' });
  }
});

/**
 * GET /api/donghua/detail/:slug
 * Get donghua detail
 */
router.get('/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await anichin.getDonghuaDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Donghua not found' });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching donghua detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch donghua detail' });
  }
});

/**
 * GET /api/donghua/episode/:slug
 * Get episode streaming data
 */
router.get('/episode/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await anichin.getEpisodeDetail(slug);
    
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
