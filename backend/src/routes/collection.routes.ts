import { Router, Response } from 'express';
import { Collection } from '../models';
import { auth, AuthRequest } from '../middleware';
import mongoose from 'mongoose';

const router = Router();

// ==================== COLLECTIONS ====================

/**
 * GET /api/collections
 * Get user's collections
 */
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const collections = await Collection.find({ userId: req.user!.id })
      .sort({ updatedAt: -1 })
      .select('-films'); // Don't include films in list view for performance

    res.json({
      success: true,
      data: collections,
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ success: false, error: 'Failed to get collections' });
  }
});

/**
 * POST /api/collections
 * Create new collection
 */
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isPublic } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Collection name is required' });
      return;
    }

    // Check if collection with same name exists
    const existing = await Collection.findOne({ userId: req.user!.id, name: name.trim() });
    if (existing) {
      res.status(400).json({ success: false, error: 'Collection with this name already exists' });
      return;
    }

    const collection = await Collection.create({
      userId: req.user!.id,
      name: name.trim(),
      description: description?.trim() || '',
      isPublic: isPublic || false,
      films: [],
    });

    res.status(201).json({
      success: true,
      message: 'Collection created',
      data: collection,
    });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to create collection' });
  }
});

/**
 * GET /api/collections/:id
 * Get collection by ID with films
 */
router.get('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const collection = await Collection.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: req.user!.id,
    });

    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    res.json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to get collection' });
  }
});

/**
 * PUT /api/collections/:id
 * Update collection
 */
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isPublic } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const updateData: { name?: string; description?: string; isPublic?: boolean } = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const collection = await Collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: req.user!.id },
      updateData,
      { new: true }
    );

    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Collection updated',
      data: collection,
    });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to update collection' });
  }
});

/**
 * DELETE /api/collections/:id
 * Delete collection
 */
router.delete('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const result = await Collection.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: req.user!.id,
    });

    if (!result) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Collection deleted',
    });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete collection' });
  }
});

// ==================== FILMS IN COLLECTION ====================

/**
 * POST /api/collections/:id/films
 * Add film to collection
 */
router.post('/:id/films', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { filmId, title, slug, poster, year, quality } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    if (!filmId || !title || !slug) {
      res.status(400).json({ success: false, error: 'Film ID, title, and slug are required' });
      return;
    }

    const collection = await Collection.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: req.user!.id,
    });

    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    // Check if film already in collection
    const filmExists = collection.films.some(f => f.filmId === filmId);
    if (filmExists) {
      res.status(400).json({ success: false, error: 'Film already in collection' });
      return;
    }

    // Add film to collection
    collection.films.push({
      filmId,
      title,
      slug,
      poster: poster || '',
      year: year || '',
      quality: quality || 'HD',
      addedAt: new Date(),
    });

    await collection.save();

    res.json({
      success: true,
      message: 'Film added to collection',
      data: collection,
    });
  } catch (error) {
    console.error('Add film to collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to add film to collection' });
  }
});

/**
 * DELETE /api/collections/:id/films/:filmId
 * Remove film from collection
 */
router.delete('/:id/films/:filmId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, filmId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const collection = await Collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: req.user!.id },
      { $pull: { films: { filmId } } },
      { new: true }
    );

    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Film removed from collection',
      data: collection,
    });
  } catch (error) {
    console.error('Remove film from collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove film from collection' });
  }
});

export default router;
