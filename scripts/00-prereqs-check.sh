#!/usr/bin/env bash
# Verifies all local tools required for this project are installed.
set -euo pipefail
need() { command -v "$1" >/dev/null 2>&1 || { echo "MISSING: $1"; MISSING=1; }; }
MISSING=0
for t in docker kind kubectl helm git kubeseal; do need "$t"; done
if [ "${MISSING:-0}" = "1" ]; then
  cat <<MSG

Some tools are missing. Install guides:
  docker     https://docs.docker.com/engine/install/
  kind       https://kind.sigs.k8s.io/docs/user/quick-start/#installation
  kubectl    https://kubernetes.io/docs/tasks/tools/
  helm       https://helm.sh/docs/intro/install/
  kubeseal   https://github.com/bitnami-labs/sealed-secrets#installation (client CLI)
MSG
  exit 1
fi
echo "All prerequisites found."
