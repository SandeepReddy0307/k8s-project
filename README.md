# StreamFlix — Local End-to-End DevOps Lab

A from-scratch, Netflix-inspired microservices platform built to exercise
**every** major DevOps/Kubernetes concept — CI (GitHub Actions + Jenkins), CD
(ArgoCD GitOps), Helm, almost all core K8s resource kinds (Deployment,
StatefulSet, DaemonSet, Job, CronJob, HPA, VPA, PDB, Ingress, Gateway API,
NetworkPolicy, RBAC, Secrets/SealedSecrets, ConfigMaps, PV/PVC,
ResourceQuota/LimitRange), cert-manager, policy-as-code (Kyverno), kro, and a
full observability stack (Prometheus, Grafana, Loki, Tempo) — **100% runnable
on your local kind cluster + VM + Docker**. No cloud account required.

> This is original, purpose-built code (not a scraped "Netflix clone" repo)
> so every service maps cleanly to the K8s/DevOps feature it's meant to teach.

## 1. Repo layout

```
k8s-project/
  app/                    # source code for all 11 microservices + Dockerfiles
  infra/kind/             # kind cluster config + local Docker registry setup
  gitops/
    charts/               # one Helm chart per workload (stateless + stateful)
    apps/                 # ArgoCD App-of-Apps (root-app.yaml + child-*.yaml)
    infra-manifests/       # cert-manager, gateway-api, rbac, network-policies,
                           # resource-quota, pdb, hpa-vpa, sealed-secrets,
                           # policy (Kyverno), kro, observability (Helm values,
                           # ServiceMonitors, dashboards, alerts)
  ci/
    github-actions/        # .github/workflows for CI (self-hosted runner)
    jenkins/                # Jenkinsfile + docker-compose for Jenkins on your VM
  scripts/                 # 00-06 numbered bootstrap scripts, run in order
  docs/                    # deep-dive guides per topic
```

## 2. Architecture

```
 laptop (you)                         VM                         kind cluster
 ------------                 -------------------          ------------------------
 docker build  ------push---> local registry:5000 <--pull-- all pods
       |                              ^
       |                        Jenkins (CI #2)
 git push (app code) --> GitHub -----> self-hosted runner (CI #1: GitHub Actions)
                              |
                              v
                     streamflix-gitops repo (image tag bumped by CI)
                              |
                              v
                     ArgoCD (in kind) auto-syncs  -->  StreamFlix namespace
                                                        + Observability stack
```

Two git repos recommended:
- `streamflix-app` — this repo's `app/` + `ci/` (source + pipelines)
- `streamflix-gitops` — this repo's `gitops/` (desired state ArgoCD watches)

You can start with one monorepo and split later — just update `repoURL`/`path`
in `gitops/apps/*.yaml` and the CI workflows accordingly.

## 3. Microservice → K8s feature matrix

| Service | Workload | Feature focus |
|---|---|---|
| frontend | Deployment | Ingress, probes |
| api-gateway | Deployment | reverse proxy, Gateway API routing target |
| auth-service | Deployment | Secret (JWT), Postgres client |
| catalog-service | Deployment | HPA (CPU), Postgres client |
| user-service | Deployment | PVC (avatar/notes storage) |
| search-service | Deployment | Elasticsearch client |
| recommendation-service | Deployment (Python) | HPA on custom Prometheus metric |
| notification-service | Deployment + CronJob | Redis, scheduled digest job |
| billing-service | Deployment | VPA, Secret/SealedSecret |
| admin-dashboard | Deployment | ServiceAccount + RBAC Role/RoleBinding |
| video-encoder-job | Job + CronJob | batch processing pattern |
| postgres | StatefulSet | PVC via volumeClaimTemplates, PDB, headless Service |
| redis | StatefulSet | headless Service, PVC |
| elasticsearch | StatefulSet | initContainers, PVC |
| nats | StatefulSet | event bus (stretch: async events) |
| log-shipper | DaemonSet | hostPath volumes, node-level log shipping to Loki |

Plus cluster-wide: Ingress, Gateway API (canary weighting), NetworkPolicy
(default-deny + explicit allows), RBAC (namespace Role + cluster ClusterRole),
ResourceQuota/LimitRange, cert-manager (self-signed CA + Certificate),
SealedSecrets, Kyverno policies, and a kro `ResourceGraphDefinition`.

## 4. Prerequisites (local machine + VM)

Install on your local machine: `docker`, `kind`, `kubectl`, `helm`, `kubeseal`.
Run `bash scripts/00-prereqs-check.sh` to verify.

On the VM: `docker`, `docker compose` (for Jenkins).

## 5. Step-by-step build order

```bash
cd k8s-project

# 1. Local machine: create registry + kind cluster
bash scripts/01-create-cluster.sh

# 2. Build & push all images to the local registry (first manual pass,
#    before CI exists)
for svc in frontend api-gateway auth-service catalog-service user-service \
           search-service recommendation-service notification-service \
           billing-service admin-dashboard video-encoder-job; do
  docker build -t localhost:5000/$svc:latest app/$svc
  docker push localhost:5000/$svc:latest
done

# 3. Install cluster-wide infra (metrics-server, ingress-nginx, Gateway API,
#    cert-manager, sealed-secrets, VPA)
bash scripts/02-install-core-infra.sh

# 4. Apply namespace-scoped infra: secrets, configmaps, RBAC, network
#    policies, quotas, PDBs, cert-manager issuers/certs
kubectl apply -f gitops/charts/_secrets/
kubectl apply -f gitops/infra-manifests/rbac/
kubectl apply -f gitops/infra-manifests/network-policies/
kubectl apply -f gitops/infra-manifests/resource-quota/
kubectl apply -f gitops/infra-manifests/pdb/
kubectl apply -f gitops/infra-manifests/cert-manager/

# 5. Manually deploy everything once with Helm, to confirm each workload works
#    BEFORE handing control to ArgoCD (great for learning each chart):
for chart in postgres redis elasticsearch nats frontend api-gateway \
             auth-service catalog-service user-service search-service \
             recommendation-service notification-service billing-service \
             admin-dashboard video-encoder log-shipper; do
  helm upgrade --install $chart gitops/charts/$chart -n streamflix --create-namespace
done

# 6. Install ArgoCD, then push gitops/ to its own repo and cut over to GitOps
bash scripts/03-install-argocd.sh
#    ... push gitops/ to GitHub, edit repoURL in gitops/apps/*.yaml ...
bash scripts/05-deploy-apps.sh

# 7. Install observability stack
bash scripts/04-install-observability.sh
kubectl apply -f gitops/infra-manifests/observability/servicemonitors/
kubectl apply -f gitops/infra-manifests/observability/dashboards/
kubectl apply -f gitops/infra-manifests/observability/alerts/

# 8. Wire up CI (push app/ to GitHub, add a self-hosted runner on your VM;
#    set up Jenkins per ci/jenkins/README.md)

# 9. Add Gateway API, HPA custom metrics, Kyverno policies, kro as stretch goals
kubectl apply -f gitops/infra-manifests/gateway-api/
kubectl apply -f gitops/infra-manifests/hpa-vpa/recommendation-custom-hpa.yaml
kubectl apply -f gitops/infra-manifests/policy/
```

See `docs/` for a deep-dive per topic, and `scripts/06-port-forward-helpers.sh`
for quick access to Grafana/ArgoCD/the app once everything is running.

## 6. Verifying it all works

```bash
kubectl -n streamflix get pods,svc,sts,ds,hpa,pvc
kubectl -n argocd get applications
kubectl -n observability port-forward svc/kube-prometheus-stack-grafana 3000:80
# open http://localhost:3000  (admin / prom-operator)
```

## 7. Suggested learning order (checklist)

- [ ] kind + registry + metrics-server working
- [ ] All 16 charts deployed manually, pods Running/Ready
- [ ] Ingress reachable at `http://streamflix.local:8080` (add to `/etc/hosts`)
- [ ] RBAC: `kubectl auth can-i list pods --as=system:serviceaccount:streamflix:admin-dashboard`
- [ ] NetworkPolicy: confirm a non-gateway pod CANNOT reach catalog-service
- [ ] HPA scales catalog-service under `kubectl run load-gen ...` + `hey`/`k6`
- [ ] VPA recommends resources for billing-service (`kubectl describe vpa`)
- [ ] cert-manager issued `streamflix-tls-secret`
- [ ] SealedSecret replaces a plain Secret (see `gitops/infra-manifests/sealed-secrets`)
- [ ] ArgoCD App-of-Apps shows all children Synced + Healthy
- [ ] GitHub Actions + Jenkins both build/push on a commit
- [ ] Grafana dashboard shows live request/CPU/memory metrics
- [ ] Loki shows aggregated logs from the DaemonSet
- [ ] Gateway API HTTPRoute splits traffic 90/10 (canary)
- [ ] Kyverno rejects a pod missing resource limits
- [ ] kro `MicroserviceApp` instance produces Deployment+Service+HPA

Good luck — this is intentionally large. Work through it phase by phase
(see `docs/00-overview.md`) rather than all at once.
