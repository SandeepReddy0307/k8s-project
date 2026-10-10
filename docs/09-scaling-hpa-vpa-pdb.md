# 09 — Scaling: HPA, VPA, PDB, and health probes

## Liveness, readiness, and startup probes

Every stateless chart's Deployment template includes all three probe types,
deliberately distinct:
```yaml
startupProbe:      # "has it finished booting yet?" — disables the other probes until it passes
  httpGet: { path: /health, port: 8080 }
  failureThreshold: 30
  periodSeconds: 2   # gives up to 60s to start before liveness can kill it
livenessProbe:     # "is it still alive, or deadlocked/hung?" — failing this restarts the container
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:    # "is it ready to receive traffic right now?" — failing this removes it from the Service endpoints (no restart)
  httpGet: { path: /ready, port: 8080 }
  periodSeconds: 5
  failureThreshold: 2
```
Each service exposes separate `/health` (always 200 if the process is
running) and `/ready` (200 only once DB/Redis/Kafka connections are
established) endpoints specifically so liveness and readiness behave
differently — see `app/catalog-service/src/index.js` for the reference
implementation.
```bash
kubectl describe pod <pod> -n streamflix | grep -A5 Liveness
kubectl get events -n streamflix --field-selector reason=Unhealthy
```

## HPA — Horizontal Pod Autoscaler (scale out/in by replica count)

`catalog-service`, `api-gateway`, and `search-service` have HPAs
(`gitops/charts/<service>/templates/hpa.yaml`):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }
```
Requires the **metrics-server** (`gitops/infra-manifests/metrics-server/`)
to be installed — HPA reads live CPU/memory from it via the
`metrics.k8s.io` API.

**Generate load and watch it scale:**
```bash
kubectl run load-gen --image=busybox --restart=Never -n streamflix -- \
  /bin/sh -c "while true; do wget -q -O- http://catalog-service:8080/titles; done"
kubectl get hpa -n streamflix -w
```

## VPA — Vertical Pod Autoscaler (right-size requests/limits)

`recommendation-service` (the Python ML-ish service, most likely to have
variable memory needs) has a VPA
(`gitops/charts/recommendation-service/templates/vpa.yaml`):
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
spec:
  updatePolicy: { updateMode: "Off" }   # "Off" = recommend only, never auto-evict/resize in this lab
  resourcePolicy:
    containerPolicies:
      - containerName: recommendation-service
        minAllowed: { cpu: 50m, memory: 64Mi }
        maxAllowed: { cpu: 500m, memory: 512Mi }
```
`updateMode: "Off"` is intentional — VPA in `Auto` mode evicts/restarts pods
to resize them, which fights with HPA on the same resource (CPU) and is a
classic real-world footgun. Here it's a read-only advisor:
```bash
kubectl describe vpa recommendation-service -n streamflix
# see the "Recommendation" section — target/lower/upper bound CPU & memory
```
Requires the VPA components installed separately — see
`infra/vpa/install-vpa.sh` (clones and builds from the
`kubernetes/autoscaler` repo, since VPA has no simple Helm chart).

**Note:** HPA (replica count) and VPA (per-pod CPU/mem) must never target
the same resource metric on the same workload simultaneously in `Auto` mode
— that's why only disjoint services have each (HPA on 3 request-driven
services, VPA on 1 compute-variable one, in `Off` mode).

## PodDisruptionBudget — surviving voluntary disruptions

`catalog-service` and `auth-service` have a PDB
(`gitops/charts/<service>/templates/pdb.yaml`):
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 1
  selector: { matchLabels: { app.kubernetes.io/name: catalog-service } }
```
This protects against **voluntary** disruptions (`kubectl drain`, cluster
upgrades) — Kubernetes won't evict a pod if doing so would violate the PDB.
It does **not** protect against involuntary disruption (node crash, OOM
kill).
```bash
kubectl drain streamflix-worker --ignore-daemonsets --delete-emptydir-data
# with only 2 replicas and minAvailable: 1, watch the drain respect the PDB
# (it evicts one at a time, waiting for the replacement to be Ready first)
```

## Resource requests/limits — the foundation all of the above depends on

```yaml
resources:
  requests: { cpu: 100m, memory: 128Mi }   # what the scheduler reserves
  limits:   { cpu: 500m, memory: 256Mi }   # hard cap — OOMKilled if memory exceeded
```
Every container in every chart sets both — HPA/VPA/scheduling/ResourceQuota
all depend on `requests` existing; omitting them is one of the most common
real-world misconfigurations.
