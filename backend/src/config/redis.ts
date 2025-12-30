import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private connectionAttempted: boolean = false;

  async connect(): Promise<Redis | null> {
    if (this.connectionAttempted) {
      return this.client;
    }
    
    this.connectionAttempted = true;
    
    try {
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't retry on failure
        lazyConnect: true,
        connectTimeout: 3000,
        enableOfflineQueue: false,
      });

      // Add error handler to prevent unhandled errors
      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn('Redis connection lost:', err.message);
          this.isConnected = false;
        }
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Redis connected successfully');
      return this.client;
    } catch (error) {
      console.warn('⚠️ Redis not available, running without cache');
      this.isConnected = false;
      this.client = null;
      return null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isReady()) return null;
    try {
      return await this.client!.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isReady()) return;
    try {
      if (ttl) {
        await this.client!.setex(key, ttl, value);
      } else {
        await this.client!.set(key, value);
      }
    } catch {
      // Silently fail on cache set errors
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isReady()) return;
    try {
      await this.client!.del(key);
    } catch {
      // Silently fail
    }
  }
}

export const redis = new RedisClient();
export default redis;
