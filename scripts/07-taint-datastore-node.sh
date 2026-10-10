#!/usr/bin/env bash
# Taints one worker node so only stateful/datastore workloads (postgres,
# redis, elasticsearch, kafka) schedule onto it — the rest of the fleet
# (stateless Deployments) is repelled from this node unless it explicitly
# tolerates the taint. This is the main taints/tolerations teaching exercise:
# combine with the nodeAffinity "preference" already set on those charts so
# the datastore pods *prefer* this node once they're allowed onto it.
set -euo pipefail

NODE=$(kubectl get nodes -l zone=zone-b -o jsonpath='{.items[0].metadata.name}')
if [ -z "$NODE" ]; then
  echo "Could not find a node labeled zone=zone-b. List nodes with: kubectl get nodes --show-labels"
  exit 1
fi

kubectl taint node "$NODE" workload=datastore:NoSchedule --overwrite
kubectl label node "$NODE" workload=datastore --overwrite

echo "Tainted + labeled node: $NODE"
echo "Verify with: kubectl describe node $NODE | grep -A2 Taints"
echo
echo "To remove the taint later: kubectl taint node $NODE workload=datastore:NoSchedule-"
