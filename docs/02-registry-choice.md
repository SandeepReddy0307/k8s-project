# 02 — Registry choice: local registry vs Docker Hub

This is the single most common point of confusion in a local DevOps lab:
**"I built an image — now where does it go, and how does the cluster get it?"**

You have two valid options. This project supports both; pick one to start,
add the second later for comparison.

## Option A — Local Docker registry (`localhost:5000`)

**How it works:** a plain `registry:2` container runs on your machine. `kind`
is configured (via `infra/kind/kind-config.yaml` + `connect-registry-to-kind.sh`)
to resolve `localhost:5000` from inside the cluster's containerd, so pods can
pull images with zero internet dependency.

**Setup (already scripted):**
```bash
bash infra/kind/setup-registry.sh              # starts the registry container
kind create cluster --config infra/kind/kind-config.yaml
bash infra/kind/connect-registry-to-kind.sh    # wires registry into kind's network
```

**Build + push:**
```bash
docker build -t localhost:5000/catalog-service:v1 app/catalog-service
docker push localhost:5000/catalog-service:v1
```

**Limitation:** `localhost:5000` only means something on **your own
machine**. A GitHub-hosted Actions runner (GitHub's cloud) cannot reach it —
you must use a **self-hosted runner** (installed on your VM/laptop) for CI
to push here. See `ci/github-actions/.github/workflows/ci.yml`, which is
written assuming `runs-on: self-hosted`.

**When to use:** you want a pure "100% local, no internet account needed"
setup, and you're fine installing a self-hosted GitHub Actions runner
(e.g. on your VM) to make this reachable from CI.

## Option B — Docker Hub (free tier)

**How it works:** push to `docker.io/<your-dockerhub-username>/<service>`,
a normal public (or free-private) registry reachable from anywhere, including
GitHub's cloud-hosted Actions runners.

**Setup:**
1. Create a free account at https://hub.docker.com
2. Create a Personal Access Token: Account Settings → Security → New Access Token
3. Add it to your GitHub repo as a secret: Settings → Secrets → Actions →
   `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`

**Build + push (locally, to test manually):**
```bash
docker login -u <your-dockerhub-username>
docker build -t <your-dockerhub-username>/catalog-service:v1 app/catalog-service
docker push <your-dockerhub-username>/catalog-service:v1
```

**In CI (GitHub-hosted runner, no self-hosted runner needed):**
```yaml
- uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
- run: docker build -t docker.io/${{ secrets.DOCKERHUB_USERNAME }}/catalog-service:${{ github.sha }} app/catalog-service
- run: docker push docker.io/${{ secrets.DOCKERHUB_USERNAME }}/catalog-service:${{ github.sha }}
```
A ready-to-use version of this is in `ci/github-actions/.github/workflows/ci-dockerhub.yml`.

**Pulling into kind:** no extra wiring needed — kind's containerd can reach
the real internet by default, so `docker.io/<you>/<service>:<tag>` just works
as an `image:` field in any chart. Free Docker Hub pulls are rate-limited
(100 pulls/6h anonymous, 200/6h authenticated) — fine for a lab.

**When to use:** you want CI to run on GitHub's free cloud runners (no
self-hosted runner setup), or you want images reachable for sharing outside
your machine.

## Which should you use for this project?

Start with **Docker Hub + GitHub Actions (`ci-dockerhub.yml`)** — zero extra
setup beyond a free Docker Hub account, since it runs on GitHub's free
cloud-hosted runners with no self-hosted runner required.

Once comfortable, try the **local registry + `ci.yml`** path too (requires a
self-hosted GitHub Actions runner on your VM/laptop) — it's worth doing once
to see the "100% local, nothing leaves my network" pipeline in action, and
useful later if you add a second CI tool (e.g. Jenkins) to this project.

Switching which chart pulls from which registry is a one-line change in each
chart's `values.yaml` (`image.repository`).
