#!/usr/bin/env bash
# Convenience: opens local ports to the most commonly used UIs/services.
# Run each line in its own terminal, or install `tmux`/`overmind` to manage them.
set -euo pipefail
echo "Run these in separate terminals as needed:"
echo "kubectl -n argocd port-forward svc/argocd-server 8081:443"
echo "kubectl -n observability port-forward svc/kube-prometheus-stack-grafana 3000:80"
echo "kubectl -n observability port-forward svc/kube-prometheus-stack-prometheus 9090:9090"
echo "kubectl -n streamflix port-forward svc/frontend 8082:8080"
