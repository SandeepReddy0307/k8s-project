# StreamFlix v2

A Netflix-inspired streaming engineering project with an original responsive interface, secure sessions, service-owned data, Kubernetes deployment controls and a staged GitHub Actions → Argo CD release path.

![StreamFlix desktop preview](docs/v2/preview-desktop.png)

**Start here:** [v2 deployment guide](docs/v2/DEPLOYMENT.md), [Word architecture guide](docs/v2/StreamFlix-v2-Architecture-and-Deployment.docx), [validation record](docs/v2/VALIDATION.md), [architecture diagram](docs/v2/architecture.png).

The v2 implementation is prepared in this repository. It has not been deployed to the existing v1 cluster. Use `gitops/charts/streamflix` and the active workflows in `.github/workflows`; the individual charts and CI examples below describe the historical manual lab. Deploy v2 to a separate namespace and validate it before retiring v1.

## v2 highlights

- Streaming home, posters, search, title details, sign-in, profile, My List, resume playback and sandbox subscriptions.
- Hashed passwords, verified JWT sessions in HttpOnly cookies, CSRF checks, distributed rate limits, ownership checks and sanitized errors.
- Secret-manager references, per-service DB roles, namespace-derived Service DNS, TLS trust and a production mTLS integration.
- Probes, workload security, resources, autoscaling, disruption budgets, network policies, migrations and scheduled tasks.
- Digest-pinned image promotion, tests/audits, image scans, SBOM/provenance, approved deployment and later scoped GitOps.

Production acceptance needs real infrastructure/identities and a successful staging release. Payment processing and video transcoding remain documented sandbox/concept boundaries. See the Word guide for the complete implementation and limits.

---

## Historical v1 manual lab

# StreamFlix — Local End-to-End DevOps Lab

A from-scratch, Netflix-inspired microservices platform built to exercise
**every** major DevOps/Kubernetes concept — CI/CD (GitHub Actions), CD
(ArgoCD GitOps), Helm, nearly all core K8s resource kinds (Deployment,
StatefulSet, DaemonSet, Job, CronJob, HPA, VPA, PDB, Ingress, Gateway API,
NetworkPolicy, RBAC, Secrets/SealedSecrets, ConfigMaps, PV/PVC,
ResourceQuota/LimitRange, taints/tolerations, node affinity), cert-manager,
policy-as-code (Kyverno), kro, Kafka event streaming, and a full
observability stack (Prometheus, Grafana, Loki) — **100% runnable on your
local kind cluster + VM + Docker**. No cloud account required.

> Original, purpose-built code (not a scraped "Netflix clone" repo) so every
> service maps cleanly to the K8s/DevOps feature it's meant to teach.

**New here? Read `docs/00-overview.md` first** — it explains the exact
end-to-end flow (code → build → registry → deploy → observe) this README
only summarizes. Every numbered doc under `docs/` is a deep dive into one
topic; this README is just the index + quick-start commands.

## The end-to-end flow, in one picture

```
 YOUR LAPTOP                              YOUR VM                      KIND CLUSTER (on laptop)
 -----------                       -------------------              ------------------------
 1. write code in app/<svc>/
 2. git push  ───────────────► GitHub repo (streamflix-app)
                                       │
                         ┌─────────────┴─────────────┐
                 Option A: self-hosted       Option B: GitHub-hosted
                 runner (on THIS machine     cloud runner
                 or the VM)                         │
                         │                           │
                 3. docker build                3. docker build
                 4. docker push to               4. docker push to
                    localhost:5000                  Docker Hub
                    (local registry)                (free account)
                         │                           │
                 5. CI commits new image tag into streamflix-gitops repo
                         │                           │
                         └─────────────┬─────────────┘
                                       ▼
                         6. ArgoCD (running IN the kind
                            cluster) detects the git change,
                            runs `helm upgrade`
                                       │
                                       ▼
                         7. kind pulls the new image, rolls
                            out the pod — app is live
                                       │
                                       ▼
                         8. Prometheus/Grafana/Loki show you
                            logs + pod/container/node metrics
```

**The one decision you must make up front:** local registry (Option A) or
Docker Hub (Option B)? Both are fully supported — see
**`docs/02-registry-choice.md`** for the exact trade-off and setup steps for
each. Short version: local registry = everything stays on your machine but
needs a self-hosted CI runner; Docker Hub = free cloud account, works with
plain GitHub-hosted Actions runners, nothing to install for CI.

## Repo layout

```
k8s-project/
  app/                    # source for all 12 microservices + Dockerfiles
  infra/kind/              # kind cluster config + local Docker registry setup
  gitops/
    charts/                # one Helm chart per workload (stateless + stateful)
    apps/                  # ArgoCD App-of-Apps (root-app.yaml + child-*.yaml)
    infra-manifests/        # cert-manager, gateway-api, rbac, network-policies,
                            # resource-quota, pdb, hpa-vpa, sealed-secrets,
                            # policy (Kyverno), kro, storage, observability
  ci/
    github-actions/         # .github/workflows — ci.yml (local registry) and
                             # ci-dockerhub.yml (Docker Hub), plus pr-checks.yml
  scripts/                  # 00-08 numbered helper scripts, run roughly in order
  docs/                      # 00-16, one deep-dive file per topic (start at 00)
```

## Microservice → K8s feature matrix

| Service | Workload | Feature focus |
|---|---|---|
| frontend | Deployment | Ingress, probes, node-affinity demo (zone-a preference) |
| api-gateway | Deployment | reverse proxy, Gateway API routing target |
| auth-service | Deployment | Secret (JWT), Postgres client, PDB |
| catalog-service | Deployment | HPA (CPU), Postgres client, Kafka **producer**, PDB |
| user-service | Deployment | PVC (avatar/notes storage) |
| search-service | Deployment | Elasticsearch client, HPA |
| recommendation-service | Deployment (Python) | VPA |
| notification-service | Deployment + CronJob | Redis, scheduled digest job |
| billing-service | Deployment | Secret/SealedSecret |
| admin-dashboard | Deployment | ServiceAccount + ClusterRole/ClusterRoleBinding (RBAC) |
| **activity-tracker** | Deployment | Kafka **consumer**, Redis, event-driven architecture |
| video-encoder-job | Job + CronJob | batch processing pattern, shared RWX PVC |
| postgres | StatefulSet | PVC via volumeClaimTemplates, headless Service, taint/toleration + node affinity |
| redis | StatefulSet | headless Service, PVC, taint/toleration + node affinity |
| elasticsearch | StatefulSet | initContainers, PVC, taint/toleration + node affinity |
| **kafka** | StatefulSet | KRaft single-node broker, event log, taint/toleration + node affinity |
| nats | StatefulSet | alternate pub/sub broker (stretch exercise) |
| log-shipper | DaemonSet | hostPath volumes, one-pod-per-node log shipping to Loki |

Plus cluster-wide: Ingress + Gateway API (both, for comparison), NetworkPolicy
(default-deny + explicit allows), RBAC, ResourceQuota/LimitRange,
taints/tolerations/node-affinity (`scripts/07-taint-datastore-node.sh`),
cert-manager, SealedSecrets, Kyverno policies, and a kro
`ResourceGraphDefinition`. Full list and where each lives: `docs/00-overview.md`.

## Prerequisites

Local machine: `docker`, `kind`, `kubectl`, `helm`, `kubeseal` — run
`bash scripts/00-prereqs-check.sh` to verify. Details:
`docs/01-prerequisites-and-tools.md`.

## Quick-start build order

```bash
cd k8s-project

# 1. Create the kind cluster (3 nodes: control-plane + 2 workers) + local registry
bash scripts/01-create-cluster.sh

# 2. Taint one worker node for dedicated stateful workloads (taints/tolerations/affinity demo)
bash scripts/07-taint-datastore-node.sh

# 3. Build & push all images once, manually, before CI exists
#    (swap localhost:5000 for docker.io/<you> if using Docker Hub — see docs/02)
for svc in frontend api-gateway auth-service catalog-service user-service \
           search-service recommendation-service notification-service \
           billing-service admin-dashboard activity-tracker video-encoder-job; do
  docker build -t localhost:5000/$svc:latest app/$svc
  docker push localhost:5000/$svc:latest
done

# 4. Install cluster-wide infra (metrics-server, ingress-nginx, Gateway API,
#    cert-manager, sealed-secrets, VPA)
bash scripts/02-install-core-infra.sh

# 5. Apply namespace-scoped infra: secrets, RBAC, network policies, quotas,
#    PDBs, cert-manager issuers/certs
kubectl apply -f gitops/charts/_secrets/
kubectl apply -f gitops/infra-manifests/rbac/
kubectl apply -f gitops/infra-manifests/network-policies/
kubectl apply -f gitops/infra-manifests/resource-quota/
kubectl apply -f gitops/infra-manifests/pdb/
kubectl apply -f gitops/infra-manifests/cert-manager/

# 6. Deploy every chart manually first (learn each one before GitOps takes over)
for chart in postgres redis elasticsearch kafka nats frontend api-gateway \
             auth-service catalog-service user-service search-service \
             recommendation-service notification-service billing-service \
             admin-dashboard activity-tracker video-encoder log-shipper; do
  helm upgrade --install $chart gitops/charts/$chart -n streamflix --create-namespace
done

# 7. Install ArgoCD, push gitops/ to its own repo, cut over to GitOps
bash scripts/03-install-argocd.sh
#    ... push gitops/ to GitHub, edit repoURL in gitops/apps/*.yaml ...
bash scripts/05-deploy-apps.sh

# 8. Install observability (Prometheus, Grafana, Loki, dashboards, alerts)
bash scripts/04-install-observability.sh
kubectl apply -f gitops/infra-manifests/observability/servicemonitors/

# 9. Wire up CI: push app/ to GitHub; pick Option A (self-hosted runner / local
#    registry) or Option B (Docker Hub, recommended to start) per
#    docs/02-registry-choice.md

# 10. Stretch goals: Gateway API, Kyverno policies, kro
kubectl apply -f gitops/infra-manifests/gateway-api/
kubectl apply -f gitops/infra-manifests/policy/
kubectl apply -f gitops/infra-manifests/kro/rgd.yaml
```

Quick access to all UIs once running: `bash scripts/06-port-forward-helpers.sh`.

## Verifying it all works

```bash
kubectl -n streamflix get pods,svc,sts,ds,hpa,pvc
kubectl -n argocd get applications
curl -X POST http://localhost:8080/api/catalog/titles/1/view   # Kafka event flow
curl http://localhost:8080/api/activity/views/1
```

## Docs index (read in order, or jump to what you need)

| # | Doc | Covers |
|---|---|---|
| 00 | `docs/00-overview.md` | the full end-to-end flow, decision points |
| 01 | `docs/01-prerequisites-and-tools.md` | tools, accounts, versions |
| 02 | `docs/02-registry-choice.md` | **local registry vs Docker Hub — start here if confused about "where does it build"** |
| 03 | `docs/03-build-and-containerize.md` | Dockerfile patterns, tagging strategy |
| 04 | `docs/04-kind-cluster-and-nodes.md` | taints, tolerations, node affinity, nodeSelector, topology spread |
| 05 | `docs/05-workloads-overview.md` | Deployment vs StatefulSet vs DaemonSet vs Job/CronJob |
| 06 | `docs/06-services-networking.md` | Service types, Ingress, Gateway API, NetworkPolicy |
| 07 | `docs/07-config-and-secrets.md` | ConfigMaps, Secrets, SealedSecrets, cert-manager, RBAC |
| 08 | `docs/08-storage.md` | PV, PVC, StorageClass, static vs dynamic provisioning |
| 09 | `docs/09-scaling-hpa-vpa-pdb.md` | probes, HPA, VPA, PodDisruptionBudget |
| 10 | `docs/10-security-rbac-netpol-certs.md` | Pod Security Standards, Kyverno, Trivy |
| 11 | `docs/11-cicd-pipeline.md` | GitHub Actions, both registry paths |
| 12 | `docs/12-gitops-argocd.md` | App-of-Apps, sync policy, the full GitOps loop |
| 13 | `docs/13-observability.md` | logs/metrics for pods, containers, AND nodes |
| 14 | `docs/14-messaging-kafka.md` | Kafka event streaming, activity-tracker |
| 15 | `docs/15-advanced-kro-and-policy.md` | kro ResourceGraphDefinition |
| 16 | `docs/16-troubleshooting.md` | common errors and fixes |

## Suggested learning checklist

- [ ] kind (3 nodes) + registry + metrics-server working
- [ ] Datastore node tainted; postgres/redis/elasticsearch/kafka all scheduled there
- [ ] All 18 charts deployed manually, pods Running/Ready
- [ ] Ingress reachable at `http://streamflix.local` (add to `/etc/hosts`)
- [ ] Kafka event flow verified: `/titles/:id/view` → activity-tracker → Redis view count
- [ ] RBAC: `kubectl auth can-i list pods --as=system:serviceaccount:streamflix:admin-dashboard`
- [ ] NetworkPolicy: confirm a non-gateway pod CANNOT reach postgres
- [ ] HPA scales catalog-service under synthetic load
- [ ] VPA recommends resources for recommendation-service (`kubectl describe vpa`)
- [ ] cert-manager issued `streamflix-tls-secret`
- [ ] SealedSecret replaces a plain Secret
- [ ] ArgoCD App-of-Apps shows all children Synced + Healthy; `selfHeal` reverts a manual `kubectl scale`
- [ ] GitHub Actions: both `ci.yml` (local registry) and `ci-dockerhub.yml` (Docker Hub) build/push on a commit
- [ ] Grafana shows live pod/container/node metrics; Loki shows aggregated logs
- [ ] Gateway API HTTPRoute routes `/api/search` correctly
- [ ] Kyverno rejects a pod missing resource limits
- [ ] kro `MicroserviceApp` instance produces Deployment+Service+HPA from one object

This is intentionally large — work through it phase by phase using the docs
above rather than all at once.
