#!/usr/bin/env bash
# Installs Prometheus+Grafana+Alertmanager, Loki+Promtail, and Tempo.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null
helm repo update >/dev/null

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace observability \
  -f "$ROOT/gitops/infra-manifests/observability/kube-prometheus-stack-values.yaml"

helm upgrade --install loki grafana/loki-stack \
  --namespace observability \
  -f "$ROOT/gitops/infra-manifests/observability/loki-values.yaml"

helm upgrade --install tempo grafana/tempo \
  --namespace observability \
  -f "$ROOT/gitops/infra-manifests/observability/tempo-values.yaml"

echo "Observability stack installed. Port-forward Grafana with:"
echo "  kubectl -n observability port-forward svc/kube-prometheus-stack-grafana 3000:80"
echo "  default creds: admin / prom-operator"
