const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const client = require('prom-client');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'authdb',
});

const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ready' }); }
  catch (e) { res.status(503).json({ status: 'db-unavailable', error: e.message }); }
});
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL
  )`);
}

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    await pool.query('INSERT INTO users(email, password) VALUES ($1,$2)', [email, password]);
    res.status(201).json({ message: 'registered' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE email=$1 AND password=$2', [email, password]);
  if (r.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

ensureSchema()
  .then(() => app.listen(PORT, () => console.log(`auth-service listening on ${PORT}`)))
  .catch((e) => { console.error('schema init failed, retrying in 5s', e.message); setTimeout(() => process.exit(1), 5000); });
