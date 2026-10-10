# 04 — kind cluster, nodes, taints/tolerations, node affinity/selectors

## Cluster shape

`infra/kind/kind-config.yaml` creates **3 nodes** (all Docker containers on
your machine, kind's way of simulating a real multi-node cluster):

| Node | Role | Label |
|---|---|---|
| `streamflix-control-plane` | control-plane | `ingress-ready=true` |
| `streamflix-worker` | worker | `zone=zone-a` |
| `streamflix-worker2` | worker | `zone=zone-b` |

Having 2 worker nodes (not 1) is what makes `topologySpreadConstraints`,
taints/tolerations, and node affinity actually mean something — with only
one node, Kubernetes has no choice but to put everything there anyway.

```bash
kubectl get nodes --show-labels
```

## Taints and tolerations (dedicating a node to stateful workloads)

**Concept:** a *taint* on a node repels pods unless they explicitly
*tolerate* it. This project uses it to keep all the heavy stateful
workloads (postgres, redis, elasticsearch, kafka) on one dedicated node,
away from the stateless services — a very common real-world pattern
("dedicated node pools").

**Apply the taint** (after cluster creation):
```bash
bash scripts/07-taint-datastore-node.sh
```
This taints the `zone-b` worker:
```bash
kubectl taint node <zone-b-node> workload=datastore:NoSchedule
kubectl label node <zone-b-node> workload=datastore
```

**Tolerations**, set in `gitops/charts/{postgres,redis,elasticsearch,kafka}/values.yaml`:
```yaml
tolerations:
  - key: "workload"
    operator: "Equal"
    value: "datastore"
    effect: "NoSchedule"
```
Without this toleration, those pods would be **rejected** from the tainted
node (and since it's the only node with the taint, that's fine — they'd just
land on the other worker, which defeats the purpose but doesn't break
anything. The point of the exercise is the pod *choosing* to tolerate it).

**Node affinity** (a *preference*, not a hard requirement) is paired with
the toleration so the datastore pods actually *want* to land there:
```yaml
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: workload
              operator: In
              values: ["datastore"]
```
`preferred` (soft) rather than `required` (hard) — if the tainted node is
down, pods can still reschedule elsewhere instead of staying Pending forever.
This is a deliberate choice for a lab environment (you don't want a single
node outage to take down your database). Change to
`requiredDuringSchedulingIgnoredDuringExecution` if you want to see the hard
version fail-closed.

**Verify it worked:**
```bash
kubectl get pods -n streamflix -o wide | grep -E 'postgres|redis|elasticsearch|kafka'
# all of these should show the same NODE (the tainted zone-b one)

kubectl get pods -n streamflix -o wide | grep -E 'frontend|api-gateway|catalog'
# these should be spread across BOTH worker nodes (topologySpreadConstraints)
```

## Node selectors / affinity for stateless services

`frontend`'s chart demonstrates a lighter-weight example — a **soft
preference** for the `zone-a` node (the one *without* the datastore taint),
via `gitops/charts/frontend/values.yaml`:
```yaml
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        preference:
          matchExpressions:
            - key: zone
              operator: In
              values: ["zone-a"]
```
Every stateless chart also exposes an empty `nodeSelector: {}` /
`tolerations: []` / `affinity: {}` in `values.yaml` — copy the pattern above
into any other service's values to pin it to a specific node the same way
(a **hard** requirement would use `nodeSelector: { zone: zone-a }` instead of
the soft `affinity` block).

## topologySpreadConstraints (spreading replicas across nodes)

Every stateless Deployment chart already includes:
```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels: { app.kubernetes.io/name: <service> }
```
This spreads a service's replicas evenly across nodes (max 1 pod difference
between nodes) so a single node failure doesn't take out every replica of a
service at once.

## Summary: scheduling concepts covered, and where

| Concept | Where used |
|---|---|
| Taint | `scripts/07-taint-datastore-node.sh` |
| Toleration | postgres/redis/elasticsearch/kafka charts |
| Node affinity (soft/preferred) | frontend chart, datastore charts |
| Node affinity (hard/required) | left as an exercise — flip `preferred` to `required` in any chart above |
| nodeSelector (hard) | available as an empty field in every chart's values.yaml — try setting it directly |
| topologySpreadConstraints | every stateless Deployment chart |
