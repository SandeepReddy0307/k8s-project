# StreamFlix v2 — deployment and release guide

The dedicated Word reference for the running local platform is [Kind-Cluster-and-Observability-Setup.docx](Kind-Cluster-and-Observability-Setup.docx). It includes installed versions, Alloy log collection, setup commands, Grafana access, verification results and troubleshooting. The broader microservice architecture is in [StreamFlix-v2-Architecture-and-Deployment.docx](StreamFlix-v2-Architecture-and-Deployment.docx).

The v2 application, consolidated Helm chart and active GitHub workflows are prepared in this repository. The old `devops` kind cluster was deleted at the user's request on 2026-10-10. The replacement is `streamflix-v2`, with context `kind-streamflix-v2`. Application releases still await GitHub Actions. Use namespace `streamflix-v2`; production requires a separate environment and resilient data services.

## What is included

The browser has an original streaming interface, 16 catalog titles, three licensed open films, title details, search, sign-in/registration, profile settings, My List, continue watching and sandbox plan selection. Fictional concept titles are labeled in their details. Session cookies are HttpOnly; the browser never stores JWTs in localStorage. Service connections come from ConfigMaps and Secret references. The browser uses only relative `/api/...` paths.

The chart manages eleven application Deployments, Services, service accounts, readiness/liveness/startup probes, CPU/memory requests/limits, topology spreading, rolling updates, HPAs, PodDisruptionBudgets, network policies, four migration Jobs and three scheduled tasks. Four single-node datastores are provided in the learning profile. VPA recommendations, ServiceMonitors, alert rules, External Secrets, cert-manager certificates and Istio strict mTLS are conditional integrations.

## One-time platform setup

For the fresh local cluster, use the versioned configuration and platform installer:

```bash
kind create cluster --config infra/kind/kind-v2.yaml
bash scripts/v2/install-platform.sh
```

The installer targets `kind-streamflix-v2` explicitly and pins all Helm chart versions. It installs Cilium, Traefik, metrics-server, cert-manager/trust-manager, Prometheus/Grafana/Alertmanager, Tempo, Loki/Alloy and VPA recommendations. External Secrets and Istio are prerequisites for the production profile; Argo CD is a later deployment phase. The local metrics-server flag skips verification of kind's kubelet certificate only. Grafana credentials are generated directly into a Secret without a plaintext password file. Alert delivery needs a separately configured receiver.

Traefik replaces the retired community ingress-nginx controller. Local browser access uses a loopback port-forward on 9443; the application origin and ingress class are set in the learning overlay. This also avoids the original cluster's 8080/8443 port bindings. The saved kind configuration does not depend on CNI hostPort support.

Install and version-pin a policy-enforcing CNI (Cilium or Calico), Traefik, metrics-server, cert-manager, trust-manager, the Prometheus Operator stack and VPA before the learning overlay. kindnet alone does not enforce NetworkPolicies. A hardened learning environment should be a fresh kind cluster with the default CNI disabled and the selected CNI installed. Do not assume the old cluster enforces these policies just because the manifests apply.

Install trust-manager in `cert-manager`, with its trust source namespace set to `cert-manager`. `gitops/platform/local-pki.yaml` puts the self-signed root certificate and its private key in that namespace. The ClusterIssuer signs leaf certificates; trust-manager distributes only the public certificate to namespaces labeled `streamflix.io/trust=true`. Ordinary application service accounts have no Secret-read permission and do not receive the root signing key.

Run from the repository root:

```bash
bash scripts/v2/prepare-learning.sh
```

This creates/labels the new namespace, generates local credentials directly into Kubernetes and installs the learning CA. The bootstrap preserves existing Secrets. It does not rotate passwords or update existing database roles. Rotation is a separate operation that must update the database and consumers together. The old v1 demo credentials should be retired when v1 is retired; removing their YAML does not erase Git history.

Kubernetes Secret values are base64-encoded, not encrypted by base64. A real cluster needs API/etcd encryption at rest, protected backups, audited RBAC and a secret manager. The learning bootstrap is intentionally different from the production secret-manager path.

## GitHub Actions

The active workflows are `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`. Historical examples under `ci/github-actions` are not active workflows and target the retired v1 layout.

1. Push the reviewed source to the intended GitHub repository. No remote commits or pushes were performed while preparing v2.
2. Allow workflow packages to be published to GHCR. The build uses the repository owner dynamically and the built-in `GITHUB_TOKEN`; there is no hardcoded personal registry namespace.
3. Enable repository permission for GitHub Actions to create pull requests. Protect `main` with the validation jobs and reviews. Restrict environments and permit workflow changes only through review.
4. CI runs Node/Python security tests, the real Postgres/Redis integration harness, Helm gates, dependency audits and desktop/mobile browser tests. It builds all twelve images from repository-root contexts, scans them, publishes SBOM/provenance and records digests.
5. One promotion job creates one PR changing `gitops/environments/images.yaml`. The full image set must be present; there are no racing per-service commits. Promotion-only changes do not retrigger image publication.
6. Review and merge the promotion PR. The resulting manifest pins every application image by digest. The learning chart also accepts an immutable Git SHA tag; production requires digests.
7. Register a dedicated self-hosted runner labeled `linux` and `streamflix` that can reach the cluster. GitHub-hosted runners cannot directly access the existing WSL kind API. Run this runner only for approved deployment jobs; it should not execute untrusted pull-request code.
8. Create GitHub environments `learning` and `production`. Set environment variable `STREAMFLIX_NAMESPACE`; require approval for production. Supply a restricted short-lived cluster identity on the runner. Do not store a cluster-admin kubeconfig in Git.
9. Run the deployment workflow for the reviewed release. Its Helm command waits for workloads and migration Jobs, has a timeout and rolls back failed Helm upgrades with `--atomic`.

Build context example for troubleshooting (CI normally performs this):

```bash
docker build -f app/frontend/Dockerfile -t streamflix/frontend:test .
```

The old `docker build app/frontend` context is incompatible with v2 because the services use a shared runtime and root lockfile.

If GHCR packages are private, provision an image pull Secret through the secret manager and set `imagePullSecrets`. Ensure migration and CronJob Pods receive the same reference. Alternatively use public learning images. The registry token should have pull-only scope.

## Browser access and certificates

For the local profile, the hostname is `streamflix-v2.local` and the browser origin is `https://streamflix-v2.local:9443`. Add the hostname once to your host DNS/hosts configuration. Domain and port are deployment configuration, not inputs the application user types into forms.

```bash
kubectl port-forward -n ingress-system svc/traefik 9443:443
```

Import the learning CA public certificate into the Windows/browser trust store; do not import its private key. Export only the public certificate if needed:

```bash
kubectl get configmap streamflix-db-ca -n streamflix-v2 \
  -o jsonpath='{.data.ca\.crt}' > /tmp/streamflix-learning-ca.crt
```

Open `https://streamflix-v2.local:9443`. HTTPS is required for Secure session cookies. The public origin setting must exactly match the browser origin for CSRF checks. A production domain uses real DNS/load-balancer ingress and an existing ACME/private-PKI issuer; the `.local` domain cannot obtain a publicly trusted ACME certificate.

## Production environment inputs

`gitops/environments/production.yaml` is a fail-closed starting profile. A platform team must supply a reviewed overlay containing a real hostname, managed Postgres host, `rediss://` Redis URL, `https://` Elasticsearch URL, TLS/SASL Kafka brokers, a Kafka authentication Secret reference, permitted destination CIDRs/ports, image digests and a public database CA ConfigMap. These values are non-secret deployment inputs; secrets come from External Secrets.

Configure the `ClusterSecretStore` using workload identity/OIDC to your chosen provider. Provider/project/region IDs cannot be inferred from this repository. Expected remote objects below the configured prefix:

| Object | Required keys |
|---|---|
| jwt | private-key (RSA PEM, auth only), public-key (RSA PEM, verification) |
| redis | password |
| elastic | username, password (least-privilege indexing/search account) |
| payment | api-key (currently sandbox use only) |
| auth-service, catalog-service, user-service, billing-service | username, password; each owns only its database |

The Kafka SASL Secret must contain `username` and `password`; provision it through the secret manager separately using `endpoints.kafkaAuthSecret`. Managed Kafka must have the configured `title-viewed` topic and appropriate ACLs. JavaScript clients support TLS and SASL/PLAIN over TLS. A trusted private Kafka CA needs Node's trusted CA configuration; publicly trusted provider certificates work with default validation.

Use Istio with Istio CNI for the production application mesh. The chosen ingress controller must participate in that mesh to send mTLS to the strict frontend/gateway; configure its injection and probe behavior as a platform prerequisite. Installing a PeerAuthentication resource alone does not encrypt traffic. Database migrations and CronJobs use external datastore TLS directly; application Deployment Pods use injected mesh proxies for service-to-service traffic.

External network destinations must be explicitly allowed. Kubernetes API access for `admin-dashboard` also needs an egress rule covering the actual API destination as seen by your CNI. The admin endpoint defaults to no allowed users; set `adminEmails` deliberately. External database CA trust, secret identities and network routing must be validated in that environment before promotion.

Managed Postgres must already contain the four application databases and isolated roles; migration Jobs create application tables, not cloud databases or admin roles. Never copy the learning database superuser into an application Pod.

## Argo CD later

Create the namespace, Secret provider/CA trust and controllers before enabling the application. Generate reviewed manifests:

```bash
python3 scripts/v2/render-argocd.py \
  --repo https://github.com/YOUR_ORG/YOUR_REPO.git \
  --namespace streamflix-v2 --profile learning > /tmp/streamflix-argocd.yaml
```

The repo URL is configured once for deployment; the application never asks end users for it. The generator produces a scoped AppProject and one Application using the consolidated chart and environment/image overlays. It restricts destination namespace and source repository, grants no cluster resource creation, enables prune/self-heal and ignores Deployment replica differences so HPA controls scaling. Infrastructure CA/mesh/CNI/controller setup belongs to a separate platform application.

Sync waves order Secrets/ConfigMaps, datastores, migrations and application Deployments. Migration names include the image version and finish before wave 2. Do not have both the Helm deployment workflow and Argo CD continuously write the same release; disable direct deployment after GitOps takeover.

## Validation, rollback and recovery

Local results are recorded in `docs/v2/VALIDATION.md`. Browser tests mock API responses and prove UI behavior; they do not prove the whole distributed deployment. Run the live smoke harness after CI deployment:

```bash
NODE_EXTRA_CA_CERTS=/tmp/streamflix-learning-ca.crt \
STREAMFLIX_BASE_URL=https://streamflix-v2.local:9443 \
node scripts/v2/live-smoke.mjs
```

The smoke harness creates test accounts and checks anonymous rejection, registration, session cookies, catalog, watchlist, progress, acknowledged Kafka/Redis event flow, search and logout. Keep TLS verification enabled. Inspect service metrics and a trace spanning gateway → service → datastore; compare emitted request IDs and check logs for all nodes/namespaces.

Helm rollback restores workload configuration but cannot undo SQL/data changes. Migrations are versioned, transactional and protected by a database advisory lock. Use backward-compatible expand/contract changes. Restore from tested backups when a data migration needs recovery.

The learning backup CronJob writes sensitive `pg_dumpall` SQL to a restricted PVC and retains seven days. This is a storage/concept exercise, not an offsite disaster-recovery solution. Production needs encrypted object-store backups/PITR, lifecycle policies, restore drills and documented RPO/RTO. Single-node learning datastores cannot provide HA. PDBs prevent voluntary drains of their sole replicas but cannot prevent hardware failure.

## Observability upgrade

The old cluster and its Loki storage were removed at the user's request. The fresh cluster uses Loki 3 and Alloy with new storage, configured under `gitops/platform/observability-v2`. The earlier Promtail node-coverage and DNS fixes belonged to the retired cluster. Live verification now confirms log ingestion from all active platform namespaces and synthetic trace retrieval from Tempo; application telemetry still awaits CI deployment.

Grafana is available through Traefik at `https://grafana.streamflix-v2.local:9443` while the loopback port-forward is running. Add this hostname to local hosts/DNS and trust the public learning CA. Retrieve the generated admin credential locally without committing or sharing it:

```bash
kubectl get secret grafana-admin -n observability -o jsonpath='{.data.admin-password}' | base64 -d
```

The local control-plane and kube-proxy metrics listeners are exposed only inside the kind Docker network. `infra/kind/kind-v2.yaml` records those bindings for rebuilds; `scripts/v2/expose-learning-metrics.py` applies the same correction to the initially created cluster. All 28 current Prometheus targets were healthy after this correction. Never apply this local listener setup to an internet-facing production node.

Prometheus collects resource/application metrics via ServiceMonitors. Alert rules cover error rate, restarts and unavailable workloads. OpenTelemetry instruments Node HTTP/Express/Postgres/Redis and Python Flask/Requests/Redis and exports OTLP HTTP to Tempo. Actual traces depend on the receiver Service/port and network policy. Notification delivery remains an in-app queue; payment processing and transcoding remain explicitly documented sandbox/concept boundaries.
