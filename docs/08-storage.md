# 08 — Storage (PV, PVC, StorageClass)

## What provides storage in kind

kind ships with the **`local-path-provisioner`** (Rancher's) as the default
`StorageClass`, which dynamically creates a `PersistentVolume` backed by a
directory on the node's filesystem whenever a `PersistentVolumeClaim` is
created — no manual PV authoring needed for the common case.
```bash
kubectl get storageclass
# standard (rancher.io/local-path)   Delete   WaitForFirstConsumer
```
`WaitForFirstConsumer` matters: the PV isn't actually bound to a specific
node until a pod using the PVC is scheduled — this is also why PVCs for
StatefulSets pair naturally with node affinity (the pod and its storage end
up pinned to whichever node the PV's hostPath directory lives on).

## PVCs used in this project

| Chart | PVC | Size | Why |
|---|---|---|---|
| `postgres` | `data-postgres-0` (via `volumeClaimTemplates`) | 2Gi | database files must survive pod restarts |
| `redis` | `data-redis-0` | 1Gi | AOF/RDB persistence file |
| `elasticsearch` | `data-elasticsearch-0` | 3Gi | search index segments |
| `kafka` | `data-kafka-0` | 2Gi | commit log segments |

```yaml
volumeClaimTemplates:
  - metadata: { name: data }
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: standard
      resources: { requests: { storage: 2Gi } }
```

## A hand-authored PV/PVC example (static provisioning)

To also demonstrate the **manual** (non-dynamic) path — authoring a `PV`
yourself and binding a `PVC` to it by name — see
`gitops/infra-manifests/storage/static-pv-example.yaml`:
```yaml
apiVersion: v1
kind: PersistentVolume
metadata: { name: shared-media-pv }
spec:
  capacity: { storage: 5Gi }
  accessModes: ["ReadWriteMany"]
  persistentVolumeReclaimPolicy: Retain
  hostPath: { path: /tmp/streamflix-shared-media }
  storageClassName: manual
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: shared-media-pvc, namespace: streamflix }
spec:
  accessModes: ["ReadWriteMany"]
  storageClassName: manual
  resources: { requests: { storage: 5Gi } }
  volumeName: shared-media-pv   # explicit bind, bypasses dynamic provisioning
```
Used by `video-encoder-job`/`video-encoder-nightly` as a shared scratch
volume multiple Job pods can read/write concurrently (`ReadWriteMany`),
unlike the `ReadWriteOnce` PVCs the StatefulSets use.

## Inspecting storage

```bash
kubectl get pv,pvc -n streamflix
kubectl describe pvc data-postgres-0 -n streamflix   # see which PV it's bound to, which node
docker exec streamflix-worker2 ls /var/local-path-provisioner/   # see actual files on the kind "node"
```

## Reclaim policy

- `Delete` (the default StorageClass) — PV (and underlying data) is deleted
  when the PVC is deleted. Fine for a lab, catastrophic in prod without
  backups.
- `Retain` (used in the static PV example) — PV survives PVC deletion, must
  be manually cleaned up or reclaimed — the safer default for anything with
  real data, which is why it's called out explicitly here.

## What happens if you delete a StatefulSet pod

```bash
kubectl delete pod postgres-0 -n streamflix
```
A new `postgres-0` is created and **reattaches to the same PVC** (same
data) — this is the entire point of StatefulSet + volumeClaimTemplates vs.
a Deployment, and worth verifying hands-on (write a row, delete the pod,
confirm the row is still there after it comes back).
