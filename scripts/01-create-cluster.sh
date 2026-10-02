#!/usr/bin/env bash
# Creates the local registry + kind cluster and wires them together.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/infra/kind/setup-registry.sh"
kind create cluster --config "$ROOT/infra/kind/kind-config.yaml"
bash "$ROOT/infra/kind/connect-registry-to-kind.sh"
kubectl cluster-info --context kind-streamflix
echo "Cluster 'streamflix' ready. Registry reachable at localhost:5000."
