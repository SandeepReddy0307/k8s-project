#!/usr/bin/env bash
# Installs cluster-wide infra: metrics-server, ingress-nginx, Gateway API CRDs,
# cert-manager, sealed-secrets controller. Run once per cluster.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "--> metrics-server (needed for HPA/VPA + kubectl top)"
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace kube-system \
  --set args='{--kubelet-insecure-tls}'   # required because kind uses self-signed kubelet certs

echo "--> ingress-nginx"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.nodeSelector."ingress-ready"="true" \
  --set controller.service.type=NodePort \
  --set controller.hostPort.enabled=true

echo "--> Gateway API CRDs (standard channel)"
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml

echo "--> Gateway API controller (nginx gateway fabric)"
kubectl apply -f https://github.com/nginxinc/nginx-gateway-fabric/releases/download/v1.4.0/nginx-gateway-fabric.yaml || true

echo "--> cert-manager"
helm repo add jetstack https://charts.jetstack.io >/dev/null
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

echo "--> sealed-secrets controller"
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets >/dev/null
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system

echo "--> VPA (Vertical Pod Autoscaler, from autoscaler repo, installed via manifests)"
TMP=$(mktemp -d)
git clone --depth 1 https://github.com/kubernetes/autoscaler "$TMP/autoscaler" 2>/dev/null || true
if [ -d "$TMP/autoscaler/vertical-pod-autoscaler" ]; then
  (cd "$TMP/autoscaler/vertical-pod-autoscaler" && ./hack/vpa-up.sh) || echo "VPA install script failed, see docs/09-scaling-hpa-vpa-pdb.md for manual steps"
fi

echo "Core infra installed. Next: 03-install-argocd.sh"
