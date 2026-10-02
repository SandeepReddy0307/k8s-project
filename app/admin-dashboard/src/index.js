const express = require('express');
const k8s = require('@kubernetes/client-node');
const client = require('prom-client');
const app = express();
const PORT = process.env.PORT || 8080;
const NAMESPACE = process.env.NAMESPACE || 'streamflix';

const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', (_req, res) => res.json({ status: 'ready' }));
app.get('/metrics', async (_req, res) => { res.set('Content-Type', register.contentType); res.end(await register.metrics()); });

// Uses in-cluster config loaded from the ServiceAccount token mounted via RBAC.
// The bound Role must grant "get/list/watch" on pods in this namespace (see gitops/infra-manifests/rbac).
app.get('/pods', async (_req, res) => {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();
    const api = kc.makeApiClient(k8s.CoreV1Api);
    const { body } = await api.listNamespacedPod(NAMESPACE);
    const pods = body.items.map((p) => ({ name: p.metadata.name, phase: p.status.phase, node: p.spec.nodeName }));
    res.json(pods);
  } catch (e) {
    res.status(500).json({ error: 'rbac-or-api-error', detail: e.message });
  }
});

app.listen(PORT, () => console.log(`admin-dashboard listening on ${PORT}`));
