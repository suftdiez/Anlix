import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import redis from './config/redis';
import { authRoutes, animeRoutes, donghuaRoutes, userRoutes, dramaRoutes, filmRoutes, komikRoutes, novelRoutes } from './routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Track database connection status
let dbConnected = false;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration - allow all origins for now
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check - IMPORTANT: Railway checks /api/health
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    redis: redis.isReady() ? 'connected' : 'disconnected',
  });
});

// Legacy health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/donghua', donghuaRoutes);
app.use('/api/user', userRoutes);
app.use('/api/drama', dramaRoutes);
app.use('/api/film', filmRoutes);
app.use('/api/komik', komikRoutes);
app.use('/api/novel', novelRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'ANLIX API',
    version: '1.0.0',
    description: 'Anime, Donghua, Drama & Film Streaming API',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      anime: '/api/anime',
      donghua: '/api/donghua',
      drama: '/api/drama',
      film: '/api/film',
      komik: '/api/komik',
      novel: '/api/novel',
      user: '/api/user',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// Start server
const startServer = async () => {
  try {
    // Start server first (so healthcheck can respond)
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║     🎬 ANLIX API Server                          ║
║                                                  ║
║     Running on port: ${PORT}                         ║
║     Environment: ${process.env.NODE_ENV || 'development'}                   ║
║                                                  ║
╚══════════════════════════════════════════════════╝
      `);
    });

    // Connect to MongoDB (non-blocking)
    try {
      await connectDatabase();
      dbConnected = true;
      console.log('✅ MongoDB connected');
    } catch (dbError) {
      console.warn('⚠️ MongoDB connection failed, auth features disabled:', dbError);
    }
    
    // Connect to Redis (optional)
    await redis.connect();

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
