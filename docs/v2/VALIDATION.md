# Validation record — 10 October 2026

Implemented source and manifests have been checked locally. The old `devops` cluster was deleted at the user's request on 2026-10-10 and replaced with a fresh three-node `streamflix-v2` cluster. The platform setup is recorded separately; application release validation still awaits CI deployment.

## Fresh learning platform — verified 2026-10-10

- Three Kubernetes 1.34.0 nodes Ready; context `kind-streamflix-v2`.
- Ten Helm releases deployed: Cilium, Traefik, metrics-server, cert-manager, trust-manager, kube-prometheus-stack, Tempo, Loki, Alloy and VPA recommender.
- `kubectl top nodes` succeeds; all 28 discovered Prometheus scrape targets are healthy, including controller-manager, scheduler, etcd and kube-proxy.
- Cross-node NetworkPolicy test passed initial access, denied access and explicit allowed access. Its temporary namespace was removed.
- Learning CA/ClusterIssuer/Bundle and Grafana leaf certificate are Ready/Synced. Grafana HTTPS health passed using the public CA and hostname verification.
- Loki contains namespace/pod/container/service labels and logs from all six active platform namespaces.
- A synthetic OTLP span was accepted and retrieved from Tempo. Alertmanager readiness passed.
- Application Secrets were bootstrapped directly in the new namespace; values and signing keys were withheld from logs.

Application images/releases, application distributed traces and application alerts still await GitHub Actions deployment. Alertmanager has no external notification receiver configured. Learning storage is node-local and single-instance data services do not provide production HA. The pinned legacy Tempo chart reports deprecation; migration to the maintained community chart requires a separately validated Tempo/configuration upgrade.

- Node 22 security/HTTP tests: 7 passed (password hashing/salts, input boundaries, required config, JWT verification, anonymous access, CSRF/sanitized async errors/security headers, real HTTP gateway forwarding with rate-limit dependency stubbed).
- Python recommendation tests: 4 passed (health, readiness failure, structured cache response, dependency failure).
- Playwright: 6 passed across desktop Chromium and mobile Pixel 7 profiles. Covers catalog/details, login/watchlist/sandbox subscription, search and failure states. APIs are mocked; screenshots are stored alongside this record.
- Helm/local code validation: passed for the v2 application chart, including Secret references, namespace-derived DNS, workload security, migrations/CronJobs, production fail-closed and shell/workflow syntax.
- Node production dependency audit: zero known vulnerabilities at validation time.
- Python service dependency audit: no known vulnerabilities at validation time.
- Production overlay: complete synthetic environment inputs render successfully; learning datastores are absent and application images are digest-pinned. Missing required production inputs fail closed.
- Loki chart 18.3.0 and Alloy chart 1.13.1: rendered and deployed successfully, using Loki 3.7.0 and Alloy v1.20.1. Live log ingestion was verified as recorded above.
- GitHub Actions references: resolved to immutable commit SHAs using the upstream tag references.
- Isolated real-service integration harness: prepared and attempted. Docker Desktop could not pull postgres:16-alpine because registry-1.docker.io timed out; service integration did not run locally. It is an explicit CI gate.
- Application image builds/scans, actual GitHub CI run, application rollout/live smoke, application DB TLS, production mTLS, Argo CD sync, load testing, backup restore and secret rotation remain unverified. Platform rollout, cross-node NetworkPolicy enforcement and Grafana HTTPS trust passed the checks above.

These results describe a hardened implementation and reviewable deployment path. Production acceptance still depends on the supplied infrastructure, identities and successful staging verification.
