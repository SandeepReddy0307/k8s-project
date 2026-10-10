# 12 — GitOps with ArgoCD

## Why a second repo (`streamflix-gitops`)

CI (step 11) builds images and pushes them. It does **not** run
`kubectl apply` or `helm install` directly — instead, CI's last step is a
`git commit` to a **separate** repo (`streamflix-gitops`) that only contains
desired-state manifests/Helm `values.yaml`. ArgoCD, running inside the
cluster, watches that repo and reconciles the cluster to match it.

Why split from `streamflix-app` (source code + CI)?
- **Separation of concerns**: app devs touch `streamflix-app`; cluster state
  changes are reviewable in `streamflix-gitops` independent of app PRs.
- **Audit trail**: every deployed change to the cluster is a git commit in
  one dedicated repo, nothing is ever applied by a human running `kubectl
  apply` by hand.
- **Rollback = `git revert`**: no separate rollback tooling needed.

(For this local lab, both live under one `k8s-project/` folder for
convenience — `app/` plays the role of `streamflix-app`, `gitops/` plays the
role of `streamflix-gitops`. If you want the full real-world separation,
split them into two actual GitHub repos and point ArgoCD at the `gitops`
one.)

## Installing ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl port-forward svc/argocd-server -n argocd 8081:443
# username: admin
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```
Open https://localhost:8081.

## App-of-Apps pattern

`gitops/apps/root-app.yaml` is the **one** Application you create by hand;
it points at `gitops/apps/`, and every other file in that folder
(`child-frontend.yaml`, `child-kafka.yaml`, `child-activity-tracker.yaml`,
... one per service/infra component) is then auto-discovered and
auto-applied by ArgoCD itself:
```bash
kubectl apply -f gitops/apps/root-app.yaml
kubectl get applications -n argocd
# root-app, frontend, api-gateway, ..., kafka, activity-tracker — all Synced
```
This is why adding a new service to the project only ever requires **one
new file** (`gitops/apps/child-<service>.yaml`) — the root app notices it
automatically on its next reconcile loop, no manual `argocd app create`
needed.

## Sync policy

```yaml
syncPolicy:
  automated:
    prune: true      # remove resources that are no longer in git
    selfHeal: true    # revert manual kubectl edits back to match git
  syncOptions: [CreateNamespace=true]
```
Try this hands-on: `kubectl scale deployment frontend --replicas=5 -n
streamflix` manually, then watch ArgoCD silently scale it back down to
whatever `replicas:` is set to in the chart — proof `selfHeal` works, and a
good demonstration of *why* GitOps exists (manual drift gets corrected).

## The full loop, end to end

```
dev edits app/catalog-service/src/index.js
  → git push (streamflix-app)
    → CI builds image, pushes to registry
      → CI commits new image tag to streamflix-gitops (charts/catalog-service/values.yaml)
        → ArgoCD detects the git diff (polls every 3 min, or instantly via webhook)
          → ArgoCD runs `helm upgrade` under the hood
            → kind pulls the new image, rolling-updates the Deployment
```
No step in this chain is a human running `kubectl`/`helm` by hand once it's
wired up — that's the entire point of GitOps.

## ArgoCD Notifications (optional, nice-to-have)

`gitops/infra-manifests/argocd/notifications-configmap.yaml` wires ArgoCD's
built-in notification controller to post sync success/failure to a local
webhook (e.g. a simple `ntfy.sh` topic or a Slack webhook if you have one) —
closes the loop so you don't have to keep the ArgoCD UI open to know a
deploy happened.
