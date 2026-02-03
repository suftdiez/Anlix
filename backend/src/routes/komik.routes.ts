/**
 * Komik Routes
 * API endpoints for comic (manga/manhwa/manhua) content
 */

import { Router, Request, Response } from 'express';
import * as komiku from '../scrapers/komiku';

const router = Router();

// GET /api/komik/latest - Get latest/updated comics
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const comics = await komiku.getLatest();
    res.json({ success: true, data: comics });
  } catch (error) {
    console.error('Error fetching latest komik:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch latest comics' });
  }
});

// GET /api/komik/list - Get all comics with pagination
router.get('/list', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await komiku.getList(page);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching komik list:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comic list' });
  }
});

// GET /api/komik/manga - Get manga with pagination
router.get('/manga', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await komiku.getByType('manga', page);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching manga:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch manga' });
  }
});

// GET /api/komik/manhwa - Get manhwa with pagination
router.get('/manhwa', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await komiku.getByType('manhwa', page);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching manhwa:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch manhwa' });
  }
});

// GET /api/komik/manhua - Get manhua with pagination
router.get('/manhua', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await komiku.getByType('manhua', page);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching manhua:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch manhua' });
  }
});

// GET /api/komik/search - Search comics
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }
    const comics = await komiku.search(query);
    res.json({ success: true, data: comics });
  } catch (error) {
    console.error('Error searching komik:', error);
    res.status(500).json({ success: false, error: 'Failed to search comics' });
  }
});

// GET /api/komik/detail/:slug - Get comic detail with chapters
router.get('/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const detail = await komiku.getDetail(slug);
    
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Comic not found' });
    }
    
    res.json({ success: true, data: detail });
  } catch (error) {
    console.error('Error fetching komik detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comic detail' });
  }
});

// GET /api/komik/chapter/:slug - Get chapter images for reading
router.get('/chapter/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const chapter = await komiku.getChapterImages(slug);
    
    if (!chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }
    
    res.json({ success: true, data: chapter });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chapter images' });
  }
});

// GET /api/komik/genres - Get all available genres
router.get('/genres', async (req: Request, res: Response) => {
  try {
    const genres = komiku.getGenres();
    res.json({ success: true, genres });
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch genres' });
  }
});

// GET /api/komik/genre/:genre - Get comics by genre with pagination
router.get('/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const result = await komiku.getByGenre(genre, page);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching comics by genre:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comics by genre' });
  }
});

// GET /api/komik/author/:author - Get comics by author with pagination
router.get('/author/:author', async (req: Request, res: Response) => {
  try {
    const { author } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const result = await komiku.getByAuthor(author, page);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching comics by author:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comics by author' });
  }
});

export default router;


