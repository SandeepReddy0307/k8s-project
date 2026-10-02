const express = require('express');
const client = require('prom-client');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;

// reads a SealedSecret-decrypted API key, mounted as env var from a regular Secret
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY || 'unset';

const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', (_req, res) => res.json({ status: PAYMENT_API_KEY !== 'unset' ? 'ready' : 'missing-secret' }));
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

app.post('/charge', (req, res) => {
  const { user, amount } = req.body;
  // fake processing, demonstrates secret is loaded without ever logging it
  res.json({ user, amount, status: 'charged', provider_key_loaded: PAYMENT_API_KEY !== 'unset' });
});

app.listen(PORT, () => console.log(`billing-service listening on ${PORT}`));
