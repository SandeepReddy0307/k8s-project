const { createClient } = require('redis');
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

(async () => {
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  const keys = await redis.keys('notifications:*');
  console.log(`[digest-cronjob] running at ${new Date().toISOString()}, found ${keys.length} user queues`);
  for (const key of keys) {
    const items = await redis.lRange(key, 0, -1);
    console.log(`  ${key}: ${items.length} pending notifications`);
  }
  await redis.quit();
  process.exit(0);
})();
