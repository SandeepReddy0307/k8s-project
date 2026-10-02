const express = require('express');
const { createClient } = require('redis');
const client = require('prom-client');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const redis = createClient({ url: REDIS_URL });
redis.on('error', (e) => console.error('redis error', e.message));

const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  res.json({ status: redis.isReady ? 'ready' : 'connecting' });
});
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

app.post('/notify', async (req, res) => {
  const { user, message } = req.body;
  await redis.lPush(`notifications:${user}`, message);
  res.status(201).json({ queued: true });
});

app.get('/notify/:user', async (req, res) => {
  const items = await redis.lRange(`notifications:${req.params.user}`, 0, -1);
  res.json(items);
});

redis.connect()
  .then(() => app.listen(PORT, () => console.log(`notification-service listening on ${PORT}`)))
  .catch((e) => { console.error('redis connect failed', e.message); app.listen(PORT); });
