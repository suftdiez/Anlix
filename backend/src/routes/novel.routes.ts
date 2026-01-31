/**
 * Novel Routes
 * API endpoints for novel/light novel content from MeioNovels
 */

import { Router, Request, Response } from 'express';
import * as meionovel from '../scrapers/meionovel';

const router = Router();

// GET /api/novel/latest - Get latest novels
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getLatest(page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching latest novels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch latest novels' });
  }
});

// GET /api/novel/popular - Get popular novels
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getPopular(page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching popular novels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch popular novels' });
  }
});

// GET /api/novel/china - Get Chinese novels
router.get('/china', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getByCategory('china', page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching Chinese novels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Chinese novels' });
  }
});

// GET /api/novel/jepang - Get Japanese novels
router.get('/jepang', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getByCategory('jepang', page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching Japanese novels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Japanese novels' });
  }
});

// GET /api/novel/korea - Get Korean novels
router.get('/korea', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getByCategory('korea', page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching Korean novels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Korean novels' });
  }
});

// GET /api/novel/tamat - Get completed novels
router.get('/tamat', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getByCategory('tamat', page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching completed novels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch completed novels' });
  }
});

// GET /api/novel/htl - Get human translated novels only
router.get('/htl', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getByCategory('htl', page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching HTL novels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch HTL novels' });
  }
});

// GET /api/novel/genre/:genre - Get novels by genre
router.get('/genre/:genre', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.getByGenre(genre, page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error fetching novels by genre:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch novels by genre' });
  }
});

// GET /api/novel/genres - Get all available genres
router.get('/genres', async (req: Request, res: Response) => {
  try {
    const genres = await meionovel.getGenres();
    res.json({ success: true, data: genres });
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch genres' });
  }
});

// GET /api/novel/search - Search novels
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }
    const page = parseInt(req.query.page as string) || 1;
    const result = await meionovel.search(query, page);
    res.json({ success: true, novels: result.data, hasNext: result.hasNext });
  } catch (error) {
    console.error('Error searching novels:', error);
    res.status(500).json({ success: false, error: 'Failed to search novels' });
  }
});

// GET /api/novel/detail/:slug - Get novel detail with chapters
router.get('/detail/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const detail = await meionovel.getDetail(slug);
    
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Novel not found' });
    }
    
    res.json({ success: true, data: detail });
  } catch (error) {
    console.error('Error fetching novel detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch novel detail' });
  }
});

// GET /api/novel/read/:slug/:chapter - Get chapter content for reading
router.get('/read/:slug/:chapter(*)', async (req: Request, res: Response) => {
  try {
    const { slug, chapter } = req.params;
    const content = await meionovel.getChapter(slug, chapter);
    
    if (!content) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }
    
    res.json({ success: true, data: content });
  } catch (error) {
    console.error('Error fetching chapter content:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chapter content' });
  }
});

export default router;
