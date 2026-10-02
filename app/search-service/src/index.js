const express = require('express');
const { Client } = require('@elastic/elasticsearch');
const client = require('prom-client');
const app = express();
const PORT = process.env.PORT || 8080;
const ES_URL = process.env.ES_URL || 'http://elasticsearch:9200';
const INDEX = 'titles';

const es = new Client({ node: ES_URL });
const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try { await es.ping(); res.json({ status: 'ready' }); }
  catch (e) { res.status(503).json({ status: 'es-unavailable' }); }
});
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

async function ensureIndex() {
  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) {
    await es.indices.create({ index: INDEX });
    await es.index({ index: INDEX, document: { name: 'Cluster Wars', genre: 'Sci-Fi' } });
    await es.indices.refresh({ index: INDEX });
  }
}

app.get('/search', async (req, res) => {
  const q = req.query.q || '';
  try {
    const result = await es.search({ index: INDEX, query: { match: { name: q } } });
    res.json(result.hits.hits.map((h) => h._source));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

ensureIndex()
  .then(() => app.listen(PORT, () => console.log(`search-service listening on ${PORT}`)))
  .catch((e) => { console.error('es init failed, continuing anyway', e.message); app.listen(PORT, () => console.log(`search-service listening on ${PORT} (degraded)`)); });
