# 01 — Prerequisites and tools

Install these on your **local machine** (where the kind cluster + Docker live):

| Tool | Why you need it | Install |
|---|---|---|
| Docker | Build images, run the kind cluster's nodes-as-containers, run the local registry | https://docs.docker.com/engine/install/ |
| kind | Runs a real multi-node Kubernetes cluster using Docker containers as "nodes" | https://kind.sigs.k8s.io/docs/user/quick-start/#installation |
| kubectl | Talk to the Kubernetes API | https://kubernetes.io/docs/tasks/tools/ |
| helm | Package/template/install the charts in `gitops/charts/` | https://helm.sh/docs/intro/install/ |
| kubeseal | Encrypt secrets client-side before committing them (SealedSecrets) | https://github.com/bitnami-labs/sealed-secrets#installation |
| git | Obviously | pre-installed on most systems |

Run `bash scripts/00-prereqs-check.sh` — it checks all of the above are on
your `PATH` and tells you exactly what's missing.

## Accounts you'll need (both free)

| Account | Why |
|---|---|
| GitHub | Hosts your two repos (`streamflix-app`, `streamflix-gitops`) and optionally runs CI (GitHub Actions) |
| Docker Hub (optional, only if using Option B registry) | Free public image registry reachable from GitHub-hosted runners — see `docs/02-registry-choice.md` |

## Verifying your machine is ready

```bash
docker info          # confirms Docker daemon is running
kind version
kubectl version --client
helm version
kubeseal --version
```

If any of these fail, install the missing tool before continuing — every
later script assumes all of the above work.
