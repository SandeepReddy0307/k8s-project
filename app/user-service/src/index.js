const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const client = require('prom-client');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;
const AVATAR_DIR = process.env.AVATAR_DIR || '/data/avatars'; // backed by PVC

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'userdb',
});

const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    res.json({ status: 'ready' });
  } catch (e) { res.status(503).json({ status: 'not-ready', error: e.message }); }
});
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT
  )`);
}

app.post('/profiles', async (req, res) => {
  const { email, display_name } = req.body;
  const r = await pool.query(
    'INSERT INTO profiles(email, display_name) VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET display_name=$2 RETURNING *',
    [email, display_name]
  );
  res.status(201).json(r.rows[0]);
});

app.get('/profiles/:email', async (req, res) => {
  const r = await pool.query('SELECT * FROM profiles WHERE email=$1', [req.params.email]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
  res.json(r.rows[0]);
});

// demonstrates PVC usage: write/read a note file per user under the persistent volume
app.post('/profiles/:email/note', (req, res) => {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  const file = path.join(AVATAR_DIR, `${req.params.email}.txt`);
  fs.writeFileSync(file, req.body.note || '');
  res.json({ saved: file });
});

ensureSchema()
  .then(() => app.listen(PORT, () => console.log(`user-service listening on ${PORT}`)))
  .catch((e) => { console.error('schema init failed', e.message); setTimeout(() => process.exit(1), 5000); });
