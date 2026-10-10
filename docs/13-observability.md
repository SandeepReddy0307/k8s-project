# 13 — Observability: logs, metrics, traces for pods, containers, and nodes

This is the payoff step — once this stack is up, you can answer "why is
this pod slow/crashing/using too much memory" without guessing.

## The stack

| Tool | Role |
|---|---|
| Prometheus | scrapes & stores metrics (app-level + node/container-level) |
| Grafana | dashboards over Prometheus (and Loki) |
| Loki + fluent-bit (DaemonSet) | log aggregation — ships every container's stdout/stderr off the node |
| kube-state-metrics | translates K8s **object state** (Deployment replica counts, Pod phase, etc.) into Prometheus metrics |
| node-exporter (DaemonSet) | **node-level** OS metrics (CPU, memory, disk, network) per kind node |
| cAdvisor (built into kubelet) | **per-container** resource usage — what Prometheus actually scrapes for container CPU/mem |
| Jaeger (optional) | distributed tracing across `api-gateway → catalog-service → postgres` call chains |

All installed via `gitops/infra-manifests/observability/` (the
kube-prometheus-stack Helm chart bundles Prometheus + Grafana +
kube-state-metrics + node-exporter + Alertmanager in one install; Loki +
fluent-bit are separate charts).

```bash
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
helm install loki grafana/loki-stack -n monitoring
kubectl apply -f gitops/infra-manifests/observability/servicemonitors/
```

## Viewing pod/container logs

```bash
kubectl logs -f deploy/catalog-service -n streamflix              # live tail, one service
kubectl logs -f catalog-service-xxxx --previous -n streamflix     # logs from a crashed/restarted container
```
In Grafana (Explore → Loki), the same logs are queryable across the whole
cluster, filterable by label, retained even after a pod is gone:
```
{namespace="streamflix", app="catalog-service"} |= "error"
{namespace="streamflix"} | json | level="error"
```

## Viewing pod/container metrics

```bash
kubectl top pods -n streamflix     # requires metrics-server (see docs/09)
kubectl top nodes
```
In Grafana, import dashboard **ID 15757** ("Kubernetes / Views / Pods") and
**ID 1860** ("Node Exporter Full") — both pre-provisioned in
`gitops/infra-manifests/observability/grafana-dashboards/` so they appear
automatically on first login, no manual import needed:
- Per-pod CPU/memory vs. requests/limits (shows exactly when a pod is near
  its `limits.memory` and about to get OOMKilled)
- Per-node CPU/memory/disk/network (node-exporter data)
- Container restart counts over time (catches crash-looping before you
  notice it manually)

## Application-level metrics (custom, per service)

Every service exposes `/metrics` in Prometheus text format (via
`prom-client` for Node services, `prometheus_client` for Python), scraped
via a `ServiceMonitor` per service
(`gitops/charts/<service>/templates/servicemonitor.yaml`):
```
http_requests_total{method="GET",route="/titles",status="200"} 142
http_request_duration_seconds_bucket{le="0.1"} 138
```
A custom "StreamFlix Overview" Grafana dashboard
(`gitops/infra-manifests/observability/grafana-dashboards/streamflix-overview.json`)
plots request rate, p95 latency, and error rate per service, side by side.

## Alerting

`gitops/infra-manifests/observability/alerts/streamflix-alerts.yaml` defines
`PrometheusRule`s:
```yaml
- alert: PodCrashLooping
  expr: rate(kube_pod_container_status_restarts_total{namespace="streamflix"}[15m]) > 0
  for: 5m
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 5m
```
Alertmanager routes these to a local webhook (same `ntfy.sh`/Slack pattern
as ArgoCD notifications in `12-gitops-argocd.md`) — one alerting channel for
both deployment events and runtime incidents.

## Node-level view, specifically

```bash
kubectl describe node streamflix-worker2 | grep -A10 Allocated
# shows exactly how much of the node's CPU/memory is requested/limited by
# all scheduled pods — this is the number the scheduler itself uses
```
Grafana's Node Exporter dashboard (above) complements this with historical
trend, not just a point-in-time snapshot.

## Quick access (all dashboards, one script)

```bash
bash scripts/06-port-forward-helpers.sh   # prints the commands; run each in its own terminal
# Grafana:    http://localhost:3000  (admin / prom-operator)
# Prometheus: http://localhost:9090
# ArgoCD:     http://localhost:8081
```
