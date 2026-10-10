# 10 — Security: RBAC, NetworkPolicy, Pod Security, Kyverno, cert-manager

(RBAC, cert-manager, and Secrets are covered in depth in `07-config-and-secrets.md`;
NetworkPolicy is covered in `06-services-networking.md`. This doc covers the
remaining security layers: Pod Security Standards and Kyverno policy-as-code.)

## Pod Security Standards (PSS)

The `streamflix` namespace enforces the **`restricted`** Pod Security
Standard via labels (built into Kubernetes since 1.23, no extra controller
needed):
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: streamflix
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```
`restricted` requires (among other things): no privileged containers, no
host namespaces, `runAsNonRoot: true`, a defined `seccompProfile`, and all
capabilities dropped except what's explicitly added back. Every chart's
pod spec sets:
```yaml
securityContext:
  runAsNonRoot: true
  seccompProfile: { type: RuntimeDefault }
containers:
  - securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities: { drop: ["ALL"] }
```
Try intentionally breaking this (e.g. `runAsNonRoot: false` or removing
`capabilities.drop`) and re-applying — the API server itself will reject the
pod before it's even created, proof the enforcement is real.

## Kyverno — policy-as-code (beyond what PSS covers)

`gitops/infra-manifests/kyverno/policies/` adds organization-specific rules
PSS doesn't express:
```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: require-resource-limits }
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-resources
      match: { resources: { kinds: ["Pod"] } }
      validate:
        message: "CPU and memory requests/limits are required"
        pattern:
          spec:
            containers:
              - resources:
                  requests: { cpu: "?*", memory: "?*" }
                  limits:   { cpu: "?*", memory: "?*" }
```
Two more policies ship in the same folder:
- `disallow-latest-tag.yaml` — blocks any pod using `image: foo:latest`,
  forcing immutable, traceable SHA-based tags (ties back to
  `03-build-and-containerize.md`'s tagging strategy).
- `require-labels.yaml` — enforces every pod carries
  `app.kubernetes.io/name` and `app.kubernetes.io/part-of` (needed for the
  NetworkPolicy selectors and Grafana dashboards to work correctly).

```bash
kubectl apply -f gitops/infra-manifests/kyverno/policies/
kubectl get clusterpolicy
# try deploying something that violates a policy and watch it get rejected:
kubectl run bad-pod --image=nginx:latest -n streamflix
# Error from server: admission webhook "validate.kyverno.svc-fail" denied the request
```

## Trivy — image vulnerability scanning in CI

Both GitHub Actions workflows (`ci.yml`, `ci-dockerhub.yml`) run
`aquasecurity/trivy-action` against every built image before it's allowed to
push:
```yaml
- uses: aquasecurity/trivy-action@master
  with:
    image-ref: localhost:5000/${{ matrix.service }}:${{ steps.vars.outputs.sha_short }}
    severity: CRITICAL,HIGH
    exit-code: '1'   # fail the build on any CRITICAL/HIGH CVE
```

## Summary — defense-in-depth layers in this project

| Layer | Mechanism | Stops |
|---|---|---|
| Build time | Trivy scan in CI | shipping known-CVE images |
| Admission | Pod Security Standards (`restricted`) | privileged/root containers |
| Admission | Kyverno policies | missing resource limits, `:latest` tags, missing labels |
| Runtime (identity) | RBAC (per-service ServiceAccount + Role) | over-privileged API access |
| Runtime (network) | NetworkPolicy (default-deny + allow-list) | lateral movement between services |
| Data | SealedSecrets | plaintext secrets in git |
| Transport | cert-manager TLS | unencrypted ingress traffic |
