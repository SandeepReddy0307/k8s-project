#!/usr/bin/env bash
set -euo pipefail
if [[ "$(kubectl config current-context)" != "kind-streamflix-v2" ]]; then
  echo "Select kind-streamflix-v2 before bootstrapping the local learning environment." >&2
  exit 1
fi
namespace="${STREAMFLIX_NAMESPACE:-streamflix-v2}"
kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace "$namespace" streamflix.io/trust=true pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/enforce-version=v1.34 --overwrite
python3 scripts/v2/bootstrap-secrets.py --namespace "$namespace"
# cert-manager and trust-manager must be installed first; this CA stays private.
kubectl apply -f gitops/platform/local-pki.yaml
kubectl wait -n cert-manager certificate/streamflix-root --for=condition=Ready --timeout=180s
kubectl wait clusterissuer/streamflix-ca --for=condition=Ready --timeout=180s
kubectl wait bundle/streamflix-db-ca --for=condition=Synced --timeout=180s
kubectl get configmap streamflix-db-ca -n "$namespace"
