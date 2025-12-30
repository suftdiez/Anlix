import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<Redis | null> {
    try {
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Redis connected successfully');
      return this.client;
    } catch (error) {
      console.warn('⚠️ Redis connection failed, running without cache:', error);
      this.isConnected = false;
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
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isReady()) return;
    try {
      await this.client!.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }
}

export const redis = new RedisClient();
export default redis;
