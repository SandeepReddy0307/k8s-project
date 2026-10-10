# 05 — Workloads: Deployment, StatefulSet, DaemonSet, Job, CronJob

## Why each workload kind was chosen

| Workload kind | Used for | Why this kind (not another) |
|---|---|---|
| **Deployment** | frontend, api-gateway, auth-service, catalog-service, user-service, search-service, recommendation-service, notification-service, billing-service, admin-dashboard, activity-tracker | Stateless — any replica can serve any request, pods are interchangeable, rolling updates replace them freely |
| **StatefulSet** | postgres, redis, elasticsearch, kafka, nats | Needs a **stable identity** (predictable pod name + DNS: `postgres-0.postgres`), **stable storage** (each replica keeps its own PVC across restarts), and **ordered** startup/shutdown |
| **DaemonSet** | log-shipper (fluent-bit) | Needs **exactly one pod per node** — a log/metrics agent must run everywhere, not scaled independently |
| **Job** | video-encoder-sample-job (runs once at chart install) | Run-to-completion, one-off task — not a long-running server |
| **CronJob** | video-encoder-nightly, notification-service digest | Run-to-completion **on a schedule** |

## Deployment — the default choice

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 2
  strategy: {}   # defaults to RollingUpdate: replaces pods gradually, zero downtime
```
Deployments own a ReplicaSet, which owns Pods. Scaling, rolling updates, and
rollback (`kubectl rollout undo`) all come for free.

## StatefulSet — why Postgres/Redis/ES/Kafka are NOT Deployments

If you ran Postgres as a Deployment with a single shared PVC, scaling to 2
replicas would mean **two Postgres processes writing to the same disk** —
instant corruption. StatefulSet solves this with `volumeClaimTemplates`:
each replica (`postgres-0`, `postgres-1`, ...) gets its **own** PVC,
named predictably (`data-postgres-0`), so each pod always reattaches to its
own disk even after being rescheduled.

```yaml
serviceName: postgres        # required: pairs with a headless Service
volumeClaimTemplates:
  - metadata: { name: data }
    spec:
      accessModes: ["ReadWriteOnce"]
      resources: { requests: { storage: 2Gi } }
```
The paired headless Service (`clusterIP: None`) gives each pod a stable DNS
name: `postgres-0.postgres.streamflix.svc.cluster.local`. This repo's
StatefulSets are all single-replica (`replicaCount: 1`) for lab simplicity —
try bumping `postgres` to `replicaCount: 2` (with a real replication setup)
as a stretch exercise.

## DaemonSet — one pod per node, by design

```yaml
apiVersion: apps/v1
kind: DaemonSet
spec:
  template:
    spec:
      tolerations:
        - operator: Exists   # also runs on the control-plane node, which is
                              # tainted NoSchedule by default in most clusters
```
`log-shipper` (fluent-bit) needs to read `/var/log` on **every** node,
including the control-plane — that `tolerations: [{operator: Exists}]`
override is what lets it land there too (separate from the
`workload=datastore` taint used for stateful services).

```bash
kubectl get daemonset -n streamflix
kubectl get pods -n streamflix -l app.kubernetes.io/name=log-shipper -o wide
# one pod per node, confirmed by the NODE column
```

## Job — run once, to completion

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  annotations:
    "helm.sh/hook": post-install   # Helm-specific: only runs once, at install time
spec:
  backoffLimit: 2   # retry twice on failure, then give up
  template:
    spec:
      restartPolicy: OnFailure   # Jobs require OnFailure or Never, not Always
```
Trigger an ad-hoc one: `kubectl create job --from=cronjob/video-encoder-nightly manual-run-$(date +%s) -n streamflix`

## CronJob — scheduled Jobs

```yaml
apiVersion: batch/v1
kind: CronJob
spec:
  schedule: "0 2 * * *"         # standard cron syntax
  concurrencyPolicy: Forbid      # don't start a new run if the previous is still going
  successfulJobsHistoryLimit: 3  # keep the last 3 completed Jobs for inspection
  failedJobsHistoryLimit: 1
```
Two CronJobs exist in this project:
- `video-encoder-nightly` — simulated nightly batch transcode
- `notification-service-digest` — runs every 15 minutes, logs pending
  notification queue depth per user (`app/notification-service/src/digest.js`)

```bash
kubectl get cronjob -n streamflix
kubectl get jobs -n streamflix          # history of past runs
kubectl logs job/<job-name> -n streamflix
```

## Choosing the right workload — quick decision tree

```
Does it need stable per-replica storage/identity?  --> StatefulSet
Does it need to run once (or on a schedule)?        --> Job / CronJob
Does it need exactly one pod per node?              --> DaemonSet
Otherwise (the common case)                         --> Deployment
```
