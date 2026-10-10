#!/usr/bin/env bash
# Quick ad-hoc way to reach any ClusterIP service from your host machine
# without going through Ingress — useful for fast debugging.
# Usage: bash scripts/08-nodeport-debug.sh <service-name> <namespace> <target-port>
set -euo pipefail
SVC="${1:-catalog-service}"
NS="${2:-streamflix}"
PORT="${3:-8080}"

kubectl patch svc "$SVC" -n "$NS" -p '{"spec": {"type": "NodePort"}}'
NODEPORT=$(kubectl get svc "$SVC" -n "$NS" -o jsonpath="{.spec.ports[0].nodePort}")
NODE_IP=$(docker inspect -f '{{.NetworkSettings.Networks.kind.IPAddress}}' streamflix-worker)

echo "Service '$SVC' is now a NodePort."
echo "Reachable at: http://${NODE_IP}:${NODEPORT}"
echo "Revert when done: kubectl patch svc $SVC -n $NS -p '{\"spec\": {\"type\": \"ClusterIP\"}}'"
