# 07 — Config and secrets (ConfigMaps, Secrets, SealedSecrets, External Secrets pattern)

## ConfigMaps — non-sensitive configuration

Every chart separates config from code via a ConfigMap, mounted either as
env vars or a file:
```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: catalog-service-config }
data:
  LOG_LEVEL: "info"
  CACHE_TTL_SECONDS: "300"
```
```yaml
envFrom:
  - configMapRef: { name: catalog-service-config }
```
Changing a ConfigMap does **not** automatically restart pods — this project
uses the `sha256sum` checksum-annotation trick in each Deployment template:
```yaml
metadata:
  annotations:
    checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
```
so a Helm upgrade that changes the ConfigMap content also changes this
annotation, which forces a rolling restart of pods that reference it —
without this, you'd have stale config silently running in old pods.

## Secrets — sensitive values

Plain `Secret` objects exist for local work (`gitops/charts/_secrets/`), but
**never commit real plaintext secrets to git** — even in a lab, practice the
habit. This project uses **Bitnami SealedSecrets** so what's actually
committed to the GitOps repo is safe to be public:

```bash
# one-time: install the controller
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# create a secret, encrypt it, never commit the plaintext
kubectl create secret generic catalog-db-creds \
  --from-literal=POSTGRES_PASSWORD=supersecret \
  --dry-run=client -o yaml > /tmp/secret.yaml
kubeseal --format=yaml < /tmp/secret.yaml > gitops/charts/catalog-service/templates/sealed-secret.yaml
rm /tmp/secret.yaml   # never let the plaintext touch disk in the repo
```
The committed `SealedSecret` can only be decrypted by the controller running
*inside your specific cluster* (it holds the private key) — safe to push
to a public GitHub repo. The controller decrypts it into a normal `Secret`
automatically, which pods then consume exactly like any other Secret.

```yaml
envFrom:
  - secretRef: { name: catalog-db-creds }
```

## cert-manager — TLS certs issued automatically

`gitops/infra-manifests/cert-manager/` installs cert-manager plus a
self-signed `ClusterIssuer` (no internet/ACME needed for a local lab):
```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata: { name: streamflix-local-ca }
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: { name: streamflix-tls }
spec:
  secretName: streamflix-tls-secret
  issuerRef: { name: streamflix-local-ca, kind: ClusterIssuer }
  dnsNames: ["streamflix.local"]
```
The Ingress then references `tls: [{ secretName: streamflix-tls-secret, hosts: [streamflix.local] }]`.
cert-manager watches the `Certificate`, generates a keypair, and keeps the
Secret renewed automatically — same pattern used in production with a real
ACME issuer (Let's Encrypt), just swapping `selfSigned: {}` for
`acme: {...}`.

```bash
kubectl get certificate,clusterissuer -n streamflix
kubectl describe certificate streamflix-tls -n streamflix   # check Ready: True
```

## RBAC — who/what can do what

Every service has its own `ServiceAccount` (never uses `default`), paired
with a minimally-scoped `Role`/`RoleBinding`:
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: catalog-service-role, namespace: streamflix }
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]   # least privilege: read-only, this namespace only
```
`admin-dashboard` additionally has a `ClusterRole`/`ClusterRoleBinding`
(read-only on `pods`, `deployments`, `nodes`) so it can display live cluster
state in its UI — this is the one service that legitimately needs
cross-namespace/cluster-scoped read access, and it's explicitly scoped to
`get/list/watch` only (never `create/delete`).

```bash
kubectl auth can-i delete pods --as=system:serviceaccount:streamflix:catalog-service-sa -n streamflix
# no — proves least-privilege is actually enforced, not just declared
```

## ResourceQuota / LimitRange — namespace-level guardrails

`gitops/infra-manifests/policy/resourcequota.yaml` caps total CPU/memory/pod
count in the `streamflix` namespace; `limitrange.yaml` sets default
requests/limits for any container that doesn't specify its own — both are
cluster-admin-style guardrails independent of any single chart.
