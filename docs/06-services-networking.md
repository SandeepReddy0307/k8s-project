# 06 — Services & networking (ClusterIP, Ingress, Gateway API)

## Service types used

| Service type | Used for | Why |
|---|---|---|
| `ClusterIP` (default) | every internal service-to-service call (api-gateway → auth-service, etc.) | internal only, never needs external exposure |
| `Headless` (`clusterIP: None`) | postgres, redis, elasticsearch, kafka, nats | StatefulSets need stable per-pod DNS, not a single load-balanced VIP |
| `NodePort` | nothing by default, but `scripts/08-nodeport-debug.sh` shows how to temporarily expose any service this way for quick debugging | simplest way to reach a pod from your host machine without Ingress |
| `LoadBalancer` (via Cloud-Provider-KIND, optional) | the Ingress controller itself, if you install `cloud-provider-kind` | gives `kind` a real external IP instead of relying on NodePort/port-forward |

## Ingress — classic path-based routing

`gitops/infra-manifests/ingress/streamflix-ingress.yaml` uses the **NGINX
Ingress Controller** (`gitops/infra-manifests/ingress-nginx/`):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: streamflix.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: frontend, port: { number: 80 } } }
          - path: /api
            pathType: Prefix
            backend: { service: { name: api-gateway, port: { number: 8080 } } }
```
Add to `/etc/hosts` (or Windows `C:\Windows\System32\drivers\etc\hosts`):
```
127.0.0.1 streamflix.local
```
Then, since kind doesn't expose node ports to your host by default, port-forward
the ingress controller's Service:
```bash
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
curl -H "Host: streamflix.local" http://localhost:8080/
```
(kind's config already maps the control-plane's 80/443 to the host via
`extraPortMappings` — see `infra/kind/kind-config.yaml` — so plain
`curl http://streamflix.local/` also works without port-forwarding once
`/etc/hosts` is set.)

## Gateway API — the modern successor to Ingress

The `Gateway` + `HTTPRoute` resources (Kubernetes Gateway API, implemented
here by **Envoy Gateway**) live in `gitops/infra-manifests/gateway-api/`:
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: { name: streamflix-gateway }
spec:
  gatewayClassName: envoy-gateway
  listeners:
    - name: http
      port: 80
      protocol: HTTP
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: streamflix-route }
spec:
  parentRefs: [{ name: streamflix-gateway }]
  hostnames: ["streamflix.gw.local"]
  rules:
    - matches: [{ path: { type: PathPrefix, value: /api/search } }]
      backendRefs: [{ name: search-service, port: 8080 }]
    - matches: [{ path: { type: PathPrefix, value: / } }]
      backendRefs: [{ name: frontend, port: 80 }]
```
Why both Ingress *and* Gateway API are in this project: they solve the same
problem but Gateway API is the direction the ecosystem is moving
(role-based: infra team owns `Gateway`, app team owns `HTTPRoute`), and
you'll meet both in real jobs. Compare the two side-by-side here.

```bash
kubectl get gateway,httproute -n streamflix
```

## Network Policies — restricting east-west traffic

`gitops/infra-manifests/networkpolicies/` locks down traffic so, e.g.,
`postgres` only accepts connections from services that actually need it:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: postgres-allow-from-services }
spec:
  podSelector: { matchLabels: { app.kubernetes.io/name: postgres } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector: { matchLabels: { app.kubernetes.io/name: catalog-service } }
        - podSelector: { matchLabels: { app.kubernetes.io/name: user-service } }
        - podSelector: { matchLabels: { app.kubernetes.io/name: billing-service } }
      ports: [{ port: 5432, protocol: TCP }]
```
A default-deny baseline (`default-deny-ingress.yaml`) is applied first in
the `streamflix` namespace — every other NetworkPolicy is an explicit
allow-list on top of that deny-all. This requires a CNI that enforces
NetworkPolicy; kind's default (kindnet) does **not** — see
`infra/kind/kind-config.yaml` comments for the Calico swap-in used here.

## DNS — how services find each other

Every Service gets `<service>.<namespace>.svc.cluster.local`; inside the
same namespace, just `<service>` (what all the app code uses, e.g.
`postgres`, `redis`, `kafka:9092`).
```bash
kubectl run -it --rm debug --image=busybox --restart=Never -n streamflix -- nslookup catalog-service
```
