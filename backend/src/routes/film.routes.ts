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

/**
 * GET /api/film/year/:year
 * Get films by year
 */
router.get('/year/:year', async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year);
    const page = parseInt(req.query.page as string) || 1;
    
    if (isNaN(year) || year < 1900 || year > 2100) {
      res.status(400).json({ success: false, error: 'Invalid year' });
      return;
    }
    
    const result = await lk21.getFilmsByYear(year, page);
    
    res.json({
      success: true,
      year,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching films by year:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch films' });
  }
});

/**
 * GET /api/film/toprated
 * Get top rated films
 */
router.get('/toprated', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await lk21.getTopRatedFilms(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching top rated films:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch films' });
  }
});

/**
 * GET /api/film/series/featured
 * Get featured/unggulan series
 */
router.get('/series/featured', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await lk21.getFeaturedSeries(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching featured series:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured series' });
  }
});

/**
 * GET /api/film/series/update
 * Get recently updated series
 */
router.get('/series/update', async (req: Request, res: Response) => {
  try {
    const result = await lk21.getSeriesUpdate();
    
    res.json({
      success: true,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching series update:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch series update' });
  }
});

/**
 * GET /api/film/popular
 * Get popular/trending films
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const result = await lk21.getPopularFilms();
    
    res.json({
      success: true,
      hasNext: result.hasNext,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching popular films:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch popular films' });
  }
});

/**
 * GET /api/film/series/:slug
 * Get series detail with seasons and episodes
 */
router.get('/series/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await lk21.getSeriesDetail(slug);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Series not found or not a series' });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching series detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch series detail' });
  }
});

/**
 * GET /api/film/episode/:slug/stream
 * Get streaming servers for a specific episode
 */
router.get('/episode/:slug/stream', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const servers = await lk21.getEpisodeStreaming(slug);
    
    if (!servers || servers.length === 0) {
      res.status(404).json({ success: false, error: 'Episode servers not found' });
      return;
    }

    res.json({
      success: true,
      data: servers,
    });
  } catch (error) {
    console.error('Error fetching episode streaming:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch episode servers' });
  }
});

// Import TMDB service for upcoming movies
import tmdb from '../services/tmdb';

/**
 * GET /api/film/upcoming
 * Get upcoming movies from TMDB
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await tmdb.getUpcomingMovies(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      totalPages: result.totalPages,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching upcoming films:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch upcoming films' });
  }
});

/**
 * GET /api/film/nowplaying
 * Get now playing movies from TMDB
 */
router.get('/nowplaying', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    
    const result = await tmdb.getNowPlayingMovies(page);
    
    res.json({
      success: true,
      page,
      hasNext: result.hasNext,
      totalPages: result.totalPages,
      data: result.data,
    });
  } catch (error) {
    console.error('Error fetching now playing films:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch now playing films' });
  }
});

/**
 * GET /api/film/trailer/:slug
 * Get YouTube trailer for a film using TMDB API
 */
router.get('/trailer/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Parse title and year from slug
    const yearMatch = slug.match(/-(\d{4})$/);
    const year = yearMatch ? yearMatch[1] : undefined;
    
    let title = slug
      .replace(/-\d{4}$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    
    console.log(`[Trailer] Searching TMDB for: "${title}" (${year || 'no year'})`);
    
    const trailer = await tmdb.getTrailerByTitle(title, year);
    
    if (!trailer) {
      res.status(404).json({ 
        success: false, 
        error: 'Trailer not found',
        searchedTitle: title,
        searchedYear: year,
      });
      return;
    }

    res.json({
      success: true,
      data: trailer,
    });
  } catch (error) {
    console.error('Error fetching trailer:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trailer' });
  }
});

export default router;
