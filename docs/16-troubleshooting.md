# 16 — Troubleshooting

## General diagnostic order (works for 90% of issues)

```bash
kubectl get pods -n streamflix -o wide                    # 1. is it running? on which node?
kubectl describe pod <pod> -n streamflix                   # 2. check Events at the bottom
kubectl logs <pod> -n streamflix --previous                # 3. if it crashed, see why
kubectl get events -n streamflix --sort-by=.lastTimestamp  # 4. cluster-wide recent events
```

## `ImagePullBackOff` / `ErrImagePull`

| Cause | Fix |
|---|---|
| Used `localhost:5000/...` but forgot `connect-registry-to-kind.sh` | re-run `infra/kind/connect-registry-to-kind.sh` |
| Used a Docker Hub image/tag that doesn't exist (e.g. `bitnami/kafka:3.7`, confirmed removed from Hub's free tier at time of writing) | check `docker pull <image>` manually first; pick a verified-available tag |
| Forgot to `docker push` after `docker build` | `docker images` to confirm the image & tag actually exist where you think |
| Chart's `values.yaml image.repository` still points to the old registry after switching options A/B | `helm get values <release> -n streamflix` to check what's actually deployed |

## `CrashLoopBackOff`

```bash
kubectl logs <pod> -n streamflix --previous   # the PREVIOUS crashed container's output — the actual error
```
Common causes in this project specifically:
- `catalog-service`/`user-service`/`billing-service` crash if Postgres isn't
  up yet — check `kubectl get pods -n streamflix -l app.kubernetes.io/name=postgres`
  first; these services should use `/ready` (not `/health`) gated behavior,
  but a *hard* dependency at startup (vs. graceful retry) will still crash.
- `activity-tracker` logs "This server does not host this topic-partition"
  on first boot before any Kafka event has ever been published — expected,
  self-heals (see `docs/14-messaging-kafka.md`).
- OOMKilled (`kubectl describe pod` shows `Reason: OOMKilled`) — the
  container hit its `resources.limits.memory`; either fix a real memory
  leak or raise the limit in `values.yaml`.

## Pod stuck `Pending`

```bash
kubectl describe pod <pod> -n streamflix | grep -A10 Events
```
| Message | Cause |
|---|---|
| `0/3 nodes are available: 1 node(s) had taint {workload: datastore}...` | pod needs a `tolerations` entry (see `docs/04-kind-cluster-and-nodes.md`) |
| `Insufficient cpu` / `Insufficient memory` | `ResourceQuota` exhausted, or the node genuinely doesn't have capacity — check `kubectl describe node` |
| `pod has unbound immediate PersistentVolumeClaims` | PVC not yet bound — check `kubectl get pvc -n streamflix`, and that `local-path-provisioner` pod itself is healthy |

## Service unreachable / connection refused

```bash
kubectl get endpoints <service> -n streamflix
# empty? means no pod currently matches the Service's selector/readiness —
# check readinessProbe is passing (kubectl get pods shows Ready 1/1, not 0/1)
```
Also check `NetworkPolicy` (`docs/06-services-networking.md`) — a
default-deny policy without the right matching allow-rule will silently
drop traffic with no error on either side, which is the most confusing
failure mode in this whole project; always check
`kubectl get networkpolicy -n streamflix` when two services "should" be
able to talk but can't.

## ArgoCD shows `OutOfSync` forever / won't apply

- Check `kubectl get application <name> -n argocd -o yaml` → `status.conditions`
  for the actual error (often a chart template/values typo).
- `automated.selfHeal` fighting a manual `kubectl edit` you made — expected,
  revert your manual change or edit the git source instead.
- Confirm ArgoCD's repo credentials/URL are correct:
  `kubectl get secret -n argocd | grep repo`.

## Helm chart won't render / install

```bash
helm template <release> gitops/charts/<chart> --debug   # see the exact rendered YAML + line numbers on error
helm lint gitops/charts/<chart>
```

## kind cluster acting strange / want a clean slate

```bash
kind delete cluster --name streamflix
bash scripts/01-create-cluster.sh   # recreate from scratch
# NOTE: re-run scripts/07-taint-datastore-node.sh after recreating —
# taints/labels do not survive cluster recreation (only within one cluster's lifetime)
```

## "It works when I `docker run` it locally but not in the cluster"

Almost always one of:
1. Env var name mismatch between the Dockerfile's expectation and the
   chart's ConfigMap/Secret key names — `kubectl exec <pod> -- env | sort`
   to see exactly what the container actually received.
2. Service DNS name wrong — inside the cluster it's the **Service name**
   (`postgres`, `redis`, `kafka`), never `localhost`, since each container
   isn't on the same network namespace as its dependencies.
3. NetworkPolicy blocking it (see above) — works locally because
   `docker run` has no NetworkPolicy concept at all.
