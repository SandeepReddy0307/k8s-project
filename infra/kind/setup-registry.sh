#!/usr/bin/env bash
# Creates a local Docker registry container and connects it to the kind network
# so images built locally (docker build) can be pushed and pulled by the cluster
# without any cloud registry. Based on kind's official local-registry pattern.
set -euo pipefail
reg_name='streamflix-registry'
reg_port='5000'

if [ "$(docker inspect -f '{{.State.Running}}' "${reg_name}" 2>/dev/null || true)" != 'true' ]; then
  docker run -d --restart=always -p "127.0.0.1:${reg_port}:5000" --network bridge --name "${reg_name}" registry:2
  echo "started registry container ${reg_name} on port ${reg_port}"
else
  echo "registry ${reg_name} already running"
fi
