import { Router, Response } from 'express';
import { Bookmark, WatchHistory, ReadingHistory, Comment, User } from '../models';
import { auth, AuthRequest } from '../middleware';
import mongoose from 'mongoose';

const router = Router();

// ==================== BOOKMARKS ====================

/**
 * GET /api/user/bookmarks
 * Get user's bookmarks
 */
router.get('/bookmarks', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as 'anime' | 'donghua' | 'novel' | undefined;

    const query: { userId: mongoose.Types.ObjectId; contentType?: string } = {
      userId: new mongoose.Types.ObjectId(req.user?.id),
    };
    
    if (type) {
      query.contentType = type;
    }

    const bookmarks = await Bookmark.find(query)
      .sort({ addedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Bookmark.countDocuments(query);

    res.json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      data: bookmarks,
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ success: false, error: 'Failed to get bookmarks' });
  }
});

/**
 * POST /api/user/bookmarks
 * Add bookmark
 */
router.post('/bookmarks', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { contentId, contentType, title, poster, slug } = req.body;

    if (!contentId || !contentType || !title || !slug) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const bookmark = await Bookmark.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(req.user?.id),
        contentId,
        contentType,
      },
      {
        userId: new mongoose.Types.ObjectId(req.user?.id),
        contentId,
        contentType,
        title,
        poster: poster || '',
        slug,
        addedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Bookmark added',
      data: bookmark,
    });
  } catch (error) {
    console.error('Add bookmark error:', error);
    res.status(500).json({ success: false, error: 'Failed to add bookmark' });
  }
});

/**
 * DELETE /api/user/bookmarks/:id
 * Remove bookmark
 */
router.delete('/bookmarks/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await Bookmark.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(req.user?.id),
    });

    if (!result) {
      res.status(404).json({ success: false, error: 'Bookmark not found' });
      return;
    }

    res.json({ success: true, message: 'Bookmark removed' });
  } catch (error) {
    console.error('Remove bookmark error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove bookmark' });
  }
});

/**
 * GET /api/user/bookmarks/check/:contentId
 * Check if content is bookmarked
 */
router.get('/bookmarks/check/:contentId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { contentId } = req.params;
    const contentType = req.query.type as string || 'anime';

    const bookmark = await Bookmark.findOne({
      userId: new mongoose.Types.ObjectId(req.user?.id),
      contentId,
      contentType,
    });

    res.json({
      success: true,
      isBookmarked: !!bookmark,
      bookmark,
    });
  } catch (error) {
    console.error('Check bookmark error:', error);
    res.status(500).json({ success: false, error: 'Failed to check bookmark' });
  }
});

// ==================== WATCH HISTORY ====================

/**
 * GET /api/user/history
 * Get watch history
 */
router.get('/history', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await WatchHistory.find({
      userId: new mongoose.Types.ObjectId(req.user?.id),
    })
      .sort({ watchedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await WatchHistory.countDocuments({
      userId: new mongoose.Types.ObjectId(req.user?.id),
    });

    res.json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      data: history,
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

/**
 * POST /api/user/history
 * Add/update watch history
 */
router.post('/history', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { contentId, contentType, episodeId, episodeNumber, title, episodeTitle, poster, slug, progress } = req.body;

    if (!contentId || !episodeId || !title || !slug) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const history = await WatchHistory.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(req.user?.id),
        contentId,
        episodeId,
      },
      {
        userId: new mongoose.Types.ObjectId(req.user?.id),
        contentId,
        contentType: contentType || 'anime',
        episodeId,
        episodeNumber: episodeNumber || 1,
        title,
        episodeTitle: episodeTitle || '',
        poster: poster || '',
        slug,
        progress: progress || 0,
        watchedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'History updated',
      data: history,
    });
  } catch (error) {
    console.error('Update history error:', error);
    res.status(500).json({ success: false, error: 'Failed to update history' });
  }
});

/**
 * DELETE /api/user/history/:id
 * Remove history item
 */
router.delete('/history/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await WatchHistory.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(req.user?.id),
    });

    res.json({ success: true, message: 'History removed' });
  } catch (error) {
    console.error('Remove history error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove history' });
  }
});

/**
 * DELETE /api/user/history
 * Clear all history
 */
router.delete('/history', auth, async (req: AuthRequest, res: Response) => {
  try {
    await WatchHistory.deleteMany({
      userId: new mongoose.Types.ObjectId(req.user?.id),
    });

    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ success: false, error: 'Failed to clear history' });
  }
});

// ==================== READING HISTORY (NOVEL & KOMIK) ====================

/**
 * GET /api/user/reading-history
 * Get user's reading history for novels and komik
 */
router.get('/reading-history', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as 'novel' | 'komik' | undefined;

    const query: { userId: mongoose.Types.ObjectId; contentType?: string } = {
      userId: new mongoose.Types.ObjectId(req.user?.id),
    };
    
    if (type) {
      query.contentType = type;
    }

    const history = await ReadingHistory.find(query)
      .sort({ readAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await ReadingHistory.countDocuments(query);

    res.json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      data: history,
    });
  } catch (error) {
    console.error('Get reading history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get reading history' });
  }
});

/**
 * POST /api/user/reading-history
 * Save reading progress (upsert - updates if content already in history)
 * Supports both old (novelSlug) and new (contentSlug) field names for backward compatibility
 */
router.post('/reading-history', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      // New fields
      contentType = 'novel',
      contentSlug,
      contentTitle,
      contentPoster,
      // Legacy fields for backward compatibility
      novelSlug, 
      novelTitle, 
      novelPoster,
      // Common fields
      chapterSlug, 
      chapterNumber, 
      chapterTitle 
    } = req.body;

    // Support both old and new field names
    const slug = contentSlug || novelSlug;
    const title = contentTitle || novelTitle;
    const poster = contentPoster || novelPoster || '';

    if (!slug || !title || !chapterSlug) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const history = await ReadingHistory.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(req.user?.id),
        contentSlug: slug,
        contentType,
      },
      {
        userId: new mongoose.Types.ObjectId(req.user?.id),
        contentType,
        contentSlug: slug,
        contentTitle: title,
        contentPoster: poster,
        chapterSlug,
        chapterNumber: chapterNumber || '',
        chapterTitle: chapterTitle || '',
        readAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Reading progress saved',
      data: history,
    });
  } catch (error) {
    console.error('=== Save reading progress error ===');
    console.error('Full error:', error);
    console.error('Request body was:', JSON.stringify(req.body, null, 2));
    console.error('User ID:', req.user?.id);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: 'Failed to save reading progress', details: errorMessage });
  }
});

/**
 * GET /api/user/reading-history/:contentSlug
 * Get reading progress for a specific content (novel or komik)
 */
router.get('/reading-history/:contentSlug', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { contentSlug } = req.params;
    const contentType = req.query.type as string || 'novel';

    const history = await ReadingHistory.findOne({
      userId: new mongoose.Types.ObjectId(req.user?.id),
      contentSlug,
      contentType,
    });

    res.json({
      success: true,
      data: history,
      hasProgress: !!history,
    });
  } catch (error) {
    console.error('Get reading progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to get reading progress' });
  }
});

/**
 * DELETE /api/user/reading-history/:id
 * Remove reading history item
 */
router.delete('/reading-history/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await ReadingHistory.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(req.user?.id),
    });

    res.json({ success: true, message: 'Reading history removed' });
  } catch (error) {
    console.error('Remove reading history error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove reading history' });
  }
});

/**
 * DELETE /api/user/reading-history
 * Clear all reading history
 */
router.delete('/reading-history', auth, async (req: AuthRequest, res: Response) => {
  try {
    const type = req.query.type as 'novel' | 'komik' | undefined;
    
    const query: { userId: mongoose.Types.ObjectId; contentType?: string } = {
      userId: new mongoose.Types.ObjectId(req.user?.id),
    };
    
    if (type) {
      query.contentType = type;
    }
    
    await ReadingHistory.deleteMany(query);

    res.json({ success: true, message: 'Reading history cleared' });
  } catch (error) {
    console.error('Clear reading history error:', error);
    res.status(500).json({ success: false, error: 'Failed to clear reading history' });
  }
});

// ==================== COMMENTS ====================

/**
 * GET /api/user/comments/:contentId
 * Get comments for content
 */
router.get('/comments/:contentId', async (req: AuthRequest, res: Response) => {
  try {
    const { contentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const episodeId = req.query.episodeId as string;

    const query: { contentId: string; parentId: null; episodeId?: string } = {
      contentId,
      parentId: null, // Top level comments only
    };

    if (episodeId) {
      query.episodeId = episodeId;
    }

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'username avatar');

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({ parentId: comment._id })
          .sort({ createdAt: 1 })
          .populate('userId', 'username avatar');
        return {
          ...comment.toObject(),
          replies,
        };
      })
    );

    const total = await Comment.countDocuments(query);

    res.json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      data: commentsWithReplies,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get comments' });
  }
});

/**
 * POST /api/user/comments
 * Add comment
 */
router.post('/comments', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { contentId, contentType, episodeId, content, parentId } = req.body;

    if (!contentId || !content) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const comment = new Comment({
      userId: new mongoose.Types.ObjectId(req.user?.id),
      contentId,
      contentType: contentType || 'anime',
      episodeId: episodeId || null,
      content,
      parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
    });

    await comment.save();
    await comment.populate('userId', 'username avatar');

    res.status(201).json({
      success: true,
      message: 'Comment added',
      data: comment,
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

/**
 * PUT /api/user/comments/:id/like
 * Like/unlike comment
 */
router.put('/comments/:id/like', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user?.id);

    const comment = await Comment.findById(id);
    if (!comment) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    const likedIndex = comment.likedBy.findIndex(
      (uid) => uid.toString() === userId.toString()
    );

    if (likedIndex > -1) {
      // Unlike
      comment.likedBy.splice(likedIndex, 1);
      comment.likes = Math.max(0, comment.likes - 1);
    } else {
      // Like
      comment.likedBy.push(userId);
      comment.likes += 1;
    }

    await comment.save();

    res.json({
      success: true,
      liked: likedIndex === -1,
      likes: comment.likes,
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to like comment' });
  }
});

/**
 * DELETE /api/user/comments/:id
 * Delete comment
 */
router.delete('/comments/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(req.user?.id),
    });

    if (!comment) {
      res.status(404).json({ success: false, error: 'Comment not found or not authorized' });
      return;
    }

    // Delete comment and its replies
    await Comment.deleteMany({
      $or: [
        { _id: new mongoose.Types.ObjectId(id) },
        { parentId: new mongoose.Types.ObjectId(id) },
      ],
    });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

export default router;
