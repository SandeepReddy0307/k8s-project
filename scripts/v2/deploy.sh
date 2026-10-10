#!/usr/bin/env bash
set -euo pipefail
profile="${1:-learning}"
namespace="${STREAMFLIX_NAMESPACE:-streamflix-v2}"
[[ "$profile" == learning || "$profile" == production ]] || { echo 'Expected learning or production profile' >&2; exit 1; }
[[ -f gitops/environments/images.yaml ]] || exit 1
helm upgrade --install streamflix-v2 gitops/charts/streamflix -n "$namespace" \
  -f "gitops/environments/$profile.yaml" -f gitops/environments/images.yaml \
  --wait --wait-for-jobs --timeout=15m --atomic --history-max=5
# The deployment controller, readiness probes and Jobs are the release gates.
kubectl get deployment,statefulset,job,ingress -n "$namespace"
