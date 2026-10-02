const express = require('express');
const client = require('prom-client');
const app = express();
const PORT = process.env.PORT || 8080;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://api-gateway:8080';

const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpCounter = new client.Counter({ name: 'http_requests_total', help: 'Total HTTP requests', labelNames: ['route'] });
register.registerMetric(httpCounter);

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/', (req, res) => {
  httpCounter.inc({ route: '/' });
  res.send(`
    <html><body style="font-family:sans-serif;background:#141414;color:#fff;padding:2rem">
      <h1 style="color:#e50914">StreamFlix (local devops lab)</h1>
      <p>Frontend pod: ${process.env.HOSTNAME}</p>
      <p>Talking to gateway at: ${GATEWAY_URL}</p>
      <p><a style="color:#e50914" href="/catalog">View catalog via gateway</a></p>
    </body></html>
  `);
});

app.get('/catalog', async (_req, res) => {
  try {
    const r = await fetch(`${GATEWAY_URL}/api/catalog/titles`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'gateway unreachable', detail: e.message });
  }
});

app.listen(PORT, () => console.log(`frontend listening on ${PORT}`));
