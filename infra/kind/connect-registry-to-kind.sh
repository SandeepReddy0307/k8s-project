#!/usr/bin/env bash
# Run AFTER the kind cluster exists. Connects the registry container to the
# kind docker network and documents the registry to the cluster via a ConfigMap
# (per KEP-1755 local registry convention), so tools like Tilt/kubectl can discover it.
set -euo pipefail
reg_name='streamflix-registry'
kind_network='kind'

if [ "$(docker inspect -f='{{json .NetworkSettings.Networks.'"${kind_network}"'}}' "${reg_name}")" = 'null' ]; then
  docker network connect "${kind_network}" "${reg_name}"
fi

cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:5000"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
YAML
echo "registry connected to kind network and documented"
