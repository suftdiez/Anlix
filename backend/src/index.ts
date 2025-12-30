import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import redis from './config/redis';
import { authRoutes, animeRoutes, donghuaRoutes, userRoutes } from './routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://anlix.vercel.app', 'https://anlix.netlify.app']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    redis: redis.isReady() ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/donghua', donghuaRoutes);
app.use('/api/user', userRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'ANLIX API',
    version: '1.0.0',
    description: 'Anime & Donghua Streaming API',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      anime: '/api/anime',
      donghua: '/api/donghua',
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
    // Connect to MongoDB
    await connectDatabase();
    
    // Connect to Redis (optional, app works without it)
    await redis.connect();

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║     🎬 ANLIX API Server                          ║
║                                                  ║
║     Running on: http://localhost:${PORT}            ║
║     Environment: ${process.env.NODE_ENV || 'development'}                   ║
║                                                  ║
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
