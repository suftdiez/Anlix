// Flush samehadaku cache
const Redis = require('ioredis');

async function clearCache() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });
  
  try {
    // Get all samehadaku keys
    const keys = await redis.keys('samehadaku:*');
    console.log('Found', keys.length, 'samehadaku cache keys');
    
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log('Deleted all samehadaku cache keys');
    }
    
    console.log('Cache cleared successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    redis.disconnect();
  }
}

clearCache();
