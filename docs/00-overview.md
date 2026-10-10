# 00 — Overview: the exact end-to-end flow

This document answers the question "where does each step actually happen?"
because that's the part that's easy to get lost in when everything is local.

## The flow, in order

```
STEP 1          STEP 2           STEP 3              STEP 4            STEP 5             STEP 6              STEP 7
--------        --------         -----------         ------------      -----------        ------------        -----------
You write  -->  git push    -->  CI builds the  -->  Docker image  --> Image pushed   -->  kind cluster   -->  Observability
code                             image                is created        to a registry      PULLS the image     shows pods/
locally                                                                                     and runs it          logs/metrics
                                                                                             (via ArgoCD)
```

### Step 1 — Code lives in `app/`
Nothing special here — it's just source code + a `Dockerfile` per service,
already in this repo under `app/<service-name>/`.

### Step 2 — Push to a git repo (your own, on GitHub)
You need **two** GitHub repos (see `docs/11-cicd-pipeline.md` for why two):
- `streamflix-app` — contents of `app/` and `ci/` from this folder
- `streamflix-gitops` — contents of `gitops/` from this folder

```bash
cd k8s-project/app   # or wherever you split it
git init
git remote add origin https://github.com/<you>/streamflix-app.git
git push -u origin main
```

### Step 3 — WHERE does the build actually run?
This is the part most people get stuck on. You have **two choices** —
pick based on which registry you use (decided in Step 5):

| Choice | CI runs on | Why |
|---|---|---|
| **A. Self-hosted runner** | Your own VM/laptop (the one with Docker) | Needed if you push images to your **local Docker registry** (`localhost:5000`) — GitHub's cloud runners physically cannot reach a `localhost` address on your machine. |
| **B. GitHub-hosted runner** | GitHub's cloud (free minutes) | Works if you push images to **Docker Hub** (a public internet-reachable registry) — no self-hosted runner needed at all. |

**Recommendation for your setup:** start with **Option B (GitHub Actions +
Docker Hub)** — zero extra setup beyond a free Docker Hub account, since it
uses GitHub's free cloud-hosted runners. Option A (self-hosted runner +
local registry) is documented too and worth trying later for the "nothing
leaves my network" experience, once you want a second CI tool
(e.g. Jenkins) in the mix. See `docs/02-registry-choice.md` for the exact
trade-off and `docs/11-cicd-pipeline.md` for the GitHub Actions pipelines.

### Step 4 — Containerize (docker build)
Every service already has a `Dockerfile`. CI runs:
```bash
docker build -t <registry>/<service>:<git-sha> app/<service>
```
This is identical whether the registry is local or Docker Hub — only the
`<registry>` prefix changes.

### Step 5 — Push the image somewhere kind can pull it from
Two options (pick one, or set up both to compare — this repo supports both):
1. **Local registry** (`localhost:5000`) — zero signup, fastest, but only
   reachable from self-hosted runners/your own machine. Setup: `infra/kind/setup-registry.sh`.
2. **Docker Hub** (free tier, `docker.io/<your-dockerhub-username>/<service>`) —
   reachable from anywhere (including GitHub-hosted runners), requires a free
   Docker Hub account + a Personal Access Token stored as a GitHub Secret.

Both are documented with exact commands in `docs/02-registry-choice.md`.

### Step 6 — kind cluster pulls the image and runs it
This is **ArgoCD's job**, not something you run by hand once GitOps is set
up (see `docs/12-gitops-argocd.md`). The flow is:
```
CI pushes image  -->  CI updates image tag in streamflix-gitops repo
                              |
                              v
                 ArgoCD (running inside kind) notices the git change
                              |
                              v
                 ArgoCD runs `helm upgrade` under the hood
                              |
                              v
                 kind's containerd pulls the new image tag and
                 replaces the running Pods (rolling update)
```
Before you set up ArgoCD, you do this manually with `helm upgrade --install`
(see the "manual first pass" in the root `README.md`) — that's intentional,
so you understand what ArgoCD is automating before you hand over control.

### Step 7 — Observability: see logs/metrics for pods, containers, and nodes
Once deployed, `docs/13-observability.md` covers, with exact commands:
- **Node-level** metrics (CPU/memory per kind node) — `kubectl top nodes`, Grafana "Node Exporter" dashboard
- **Pod/container-level** metrics — `kubectl top pods`, Grafana "Kubernetes / Compute Resources" dashboards, your custom StreamFlix dashboard
- **Logs** — `kubectl logs`, or centrally via Loki+Grafana (shipped by the `log-shipper` DaemonSet from every node)
- **Traces** — Tempo, for request flow across frontend → gateway → catalog → postgres

## Every doc in this folder

| File | Covers |
|---|---|
| `01-prerequisites-and-tools.md` | What to install, why each tool exists |
| `02-registry-choice.md` | Local registry vs Docker Hub, step-by-step for both |
| `03-build-and-containerize.md` | Dockerfile patterns used, multi-stage, image tagging |
| `04-kind-cluster-and-nodes.md` | Node roles, labels, **taints/tolerations**, **node affinity/selectors** |
| `05-workloads-overview.md` | Deployment/StatefulSet/DaemonSet/Job/CronJob — what's used where and why |
| `06-services-networking.md` | ClusterIP/Headless/Ingress/Gateway API, traffic routing |
| `07-config-and-secrets.md` | ConfigMap, Secret, SealedSecrets workflow |
| `08-storage.md` | PV/PVC/StorageClass, which services use persistent storage |
| `09-scaling-hpa-vpa-pdb.md` | HPA, VPA, PodDisruptionBudget, ResourceQuota/LimitRange |
| `10-security-rbac-netpol-certs.md` | RBAC, NetworkPolicy, cert-manager, Kyverno policy-as-code |
| `11-cicd-pipeline.md` | Full GitHub Actions pipelines, both registry options |
| `12-gitops-argocd.md` | App-of-Apps pattern, sync policies, how a deploy actually happens |
| `13-observability.md` | Prometheus/Grafana/Loki/Tempo — viewing logs/metrics per pod/container/node |
| `14-messaging-kafka.md` | Kafka event streaming (catalog-service → activity-tracker) |
| `15-advanced-kro-and-policy.md` | kro ResourceGraphDefinition, policy-as-code |
| `16-troubleshooting.md` | Common failures and fixes |

Read them in order the first time through; after that, use them as reference.
