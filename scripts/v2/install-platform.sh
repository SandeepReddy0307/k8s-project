#!/usr/bin/env bash
# Install the StreamFlix learning platform; application images come from CI.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
context=kind-streamflix-v2
chart_cache="${STREAMFLIX_CHART_CACHE:-/tmp/streamflix-charts}"
mkdir -p "$chart_cache"
kubectl --context "$context" cluster-info >/dev/null
fetch() {
  local chart="$1" version="$2" repo="$3"
  if [[ ! -f "$chart_cache/$chart-$version.tgz" ]]; then
    helm pull "$chart" --repo "$repo" --version "$version" --destination "$chart_cache"
  fi
}
install() {
  local release="$1" chart="$2" version="$3" namespace="$4"
  shift 4
  helm upgrade --install "$release" "$chart_cache/$chart-$version.tgz" \
    --kube-context "$context" -n "$namespace" --create-namespace "$@" --wait --timeout 10m
}
fetch cilium 1.20.2 https://helm.cilium.io
fetch traefik 41.7.1 https://traefik.github.io/charts
fetch metrics-server 3.14.0 https://kubernetes-sigs.github.io/metrics-server
fetch cert-manager v1.20.4 https://charts.jetstack.io
fetch trust-manager v0.25.0 https://charts.jetstack.io
fetch kube-prometheus-stack 92.3.0 https://prometheus-community.github.io/helm-charts
fetch tempo 1.24.4 https://grafana.github.io/helm-charts
fetch loki 18.3.0 https://grafana-community.github.io/helm-charts
fetch alloy 1.13.1 https://grafana.github.io/helm-charts
fetch vpa 5.1.0 https://charts.fairwinds.com/stable
install cilium cilium 1.20.2 kube-system -f gitops/platform/cilium-learning.yaml
kubectl --context "$context" wait nodes --all --for=condition=Ready --timeout=180s
install traefik traefik 41.7.1 ingress-system -f gitops/platform/traefik-learning.yaml
install metrics-server metrics-server 3.14.0 kube-system --set 'args[0]=--kubelet-insecure-tls'
install cert-manager cert-manager v1.20.4 cert-manager --set crds.enabled=true
install trust-manager trust-manager v0.25.0 cert-manager --set app.trust.namespace=cert-manager
python3 scripts/v2/bootstrap-grafana.py
install kube-prometheus-stack kube-prometheus-stack 92.3.0 observability -f gitops/platform/prometheus-learning.yaml
install tempo tempo 1.24.4 observability -f gitops/platform/tempo-learning.yaml
install loki-v2 loki 18.3.0 observability-v2 -f gitops/platform/observability-v2/loki-values.yaml
install alloy-v2 alloy 1.13.1 observability-v2 -f gitops/platform/observability-v2/alloy-values.yaml
kubectl --context "$context" apply -f gitops/platform/observability-v2/grafana-datasource.yaml
install vpa vpa 5.1.0 kube-system --set updater.enabled=false --set admissionController.enabled=false
kubectl --context "$context" get nodes
helm list --kube-context "$context" -A
