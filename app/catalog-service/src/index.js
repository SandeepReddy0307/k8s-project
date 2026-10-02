const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');
const app = express();
const PORT = process.env.PORT || 8080;

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'catalogdb',
});

const register = new client.Registry();
client.collectDefaultMetrics({ register });
const requestDuration = new client.Histogram({ name: 'catalog_request_duration_seconds', help: 'request duration', labelNames: ['route'] });
register.registerMetric(requestDuration);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ready' }); }
  catch (e) { res.status(503).json({ status: 'db-unavailable' }); }
});
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS titles (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, genre TEXT, year INT
  )`);
  const { rows } = await pool.query('SELECT COUNT(*) FROM titles');
  if (parseInt(rows[0].count, 10) === 0) {
    await pool.query(`INSERT INTO titles(name, genre, year) VALUES
      ('Cluster Wars', 'Sci-Fi', 2024),
      ('The Pod Whisperer', 'Drama', 2023),
      ('Helm & High Water', 'Documentary', 2022),
      ('ArgoCD: Rise of GitOps', 'Action', 2025)`);
  }
}

app.get('/titles', async (_req, res) => {
  const end = requestDuration.startTimer({ route: '/titles' });
  const { rows } = await pool.query('SELECT * FROM titles ORDER BY id');
  end();
  res.json(rows);
});

ensureSchema()
  .then(() => app.listen(PORT, () => console.log(`catalog-service listening on ${PORT}`)))
  .catch((e) => { console.error('schema init failed', e.message); setTimeout(() => process.exit(1), 5000); });
