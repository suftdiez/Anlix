const Redis = require('ioredis');
const redis = new Redis();
redis.flushall().then(() => {
  console.log('Redis cleared');
  process.exit(0);
}).catch(err => {
  console.log('Redis error:', err);
  process.exit(1);
});
