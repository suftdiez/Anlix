import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models';
import { auth, AuthRequest } from '../middleware';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;

    // Validation
    if (!email || !password || !username) {
      res.status(400).json({ error: 'Email, password, and username are required' });
      return;
    }

    // Check existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      res.status(400).json({
        error: existingUser.email === email
          ? 'Email already registered'
          : 'Username already taken',
      });
      return;
    }

    // Create user
    const user = new User({ email, password, username });
    await user.save();

    // Generate token
    const token = user.generateToken();

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error: unknown) {
    console.error('Register error:', error);
    if (error instanceof Error && 'code' in error && (error as { code: number }).code === 11000) {
      res.status(400).json({ error: 'Email or username already exists' });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = user.generateToken();

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/google
 * Login or register with Google ID token
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ error: 'Google credential is required' });
      return;
    }

    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(400).json({ error: 'Invalid Google token payload' });
      return;
    }

    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists by googleId OR email
    let user = await User.findOne({ 
      $or: [{ googleId }, { email }] 
    });

    if (user) {
      // User exists. Update googleId and authProvider if they were a local user initially
      if (user.authProvider === 'local') {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (!user.avatar && picture) user.avatar = picture;
        await user.save();
      }
    } else {
      // User doesn't exist, create a new one
      // Generate a unique username based on name
      const baseUsername = name?.toLowerCase().replace(/[^a-z0-9]/g, '') || email.split('@')[0];
      let username = baseUsername;
      let counter = 1;
      
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user = new User({
        email,
        username,
        avatar: picture || '',
        googleId,
        authProvider: 'google',
      });
      await user.save();
    }

    // Generate token
    const token = user.generateToken();

    res.json({
      message: 'Google login successful',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { username, avatar } = req.body;
    const updates: { username?: string; avatar?: string } = {};

    if (username) {
      // Check if username is taken
      const existing = await User.findOne({ username, _id: { $ne: req.user?.id } });
      if (existing) {
        res.status(400).json({ error: 'Username already taken' });
        return;
      }
      updates.username = username;
    }

    if (avatar) {
      updates.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(
      req.user?.id,
      updates,
      { new: true }
    );

    res.json({
      message: 'Profile updated',
      user: {
        id: user?._id,
        email: user?.email,
        username: user?.username,
        avatar: user?.avatar,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
