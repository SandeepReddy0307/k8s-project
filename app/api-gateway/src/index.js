const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const client = require('prom-client');
const app = express();
const PORT = process.env.PORT || 8080;

const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', (_req, res) => res.json({ status: 'ready' }));
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

const routes = {
  '/api/auth': process.env.AUTH_URL || 'http://auth-service:8080',
  '/api/catalog': process.env.CATALOG_URL || 'http://catalog-service:8080',
  '/api/users': process.env.USER_URL || 'http://user-service:8080',
  '/api/search': process.env.SEARCH_URL || 'http://search-service:8080',
  '/api/recommendations': process.env.RECO_URL || 'http://recommendation-service:8080',
  '/api/notifications': process.env.NOTIF_URL || 'http://notification-service:8080',
  '/api/billing': process.env.BILLING_URL || 'http://billing-service:8080',
};

for (const [path, target] of Object.entries(routes)) {
  app.use(path, createProxyMiddleware({ target, changeOrigin: true, pathRewrite: { [`^${path}`]: '' } }));
}

app.listen(PORT, () => console.log(`api-gateway listening on ${PORT}, routes: ${Object.keys(routes).join(', ')}`));
