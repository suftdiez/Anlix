import { Router, Request, Response } from 'express';
import { lk21 } from '../scrapers';

const router = Router();

/**
 * GET /api/film/latest
 * Get latest films
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await lk21.getLatestFilms(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching latest films:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch films' });
  }
});

/**
 * GET /api/film/trending
 * Get trending/popular films
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const result = await lk21.getTrendingFilms();
    
    res.json({
      success: true,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching trending films:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch films' });
  }
});

/**
 * GET /api/film/search
 * Search films
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    
    if (!query) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    const result = await lk21.searchFilms(query, page);
    
    res.json({
      success: true,
      query,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error searching films:', error);
    res.status(500).json({ success: false, error: 'Failed to search films' });
  }
});

/**
 * GET /api/film/detail/:slug
 * Get film detail
 */
router.get('/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await lk21.getFilmDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Film not found' });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching film detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch film detail' });
  }
});

/**
 * GET /api/film/genre/:genre
 * Get films by genre
 */
router.get('/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await lk21.getFilmsByGenre(genre, page);
    
    res.json({
      success: true,
      genre,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching films by genre:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch films' });
  }
});

/**
 * GET /api/film/country/:country
 * Get films by country
 */
router.get('/country/:country', async (req: Request, res: Response) => {
  try {
    const { country } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await lk21.getFilmsByCountry(country, page);
    
    res.json({
      success: true,
      country,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching films by country:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch films' });
  }
});

export default router;
