#!/usr/bin/env bash
# Bootstraps the App-of-Apps ArgoCD Application, which then syncs every
# microservice chart + stateful infra chart from the gitops/ directory.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
kubectl create namespace streamflix --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$ROOT/gitops/apps/root-app.yaml"
echo "Root Application applied. Watch sync status with:"
echo "  kubectl -n argocd get applications"
echo "  argocd app get streamflix-root --refresh"
