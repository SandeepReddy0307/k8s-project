# 03 — Build and containerize

Every service in `app/<service>/` follows the same shape:
```
app/<service>/
  Dockerfile
  .dockerignore
  package.json (Node) or requirements.txt (Python)
  src/
```

## Dockerfile pattern (Node services)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
ENV PORT=8080
EXPOSE 8080
USER node                 # don't run as root inside the container
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["node", "src/index.js"]
```

Key choices and why:
- **`alpine` base** — small image size, faster pulls on a local registry too.
- **`COPY package.json` before `COPY src`** — Docker layer caching: dependency
  install only re-runs when `package.json` changes, not on every code edit.
- **`USER node`** — non-root container, a basic security practice that also
  satisfies some Kyverno/PodSecurity policies later.
- **`HEALTHCHECK`** — Docker-level health check, independent of (but
  complementary to) the Kubernetes liveness/readiness probes defined in each
  Helm chart.

## Dockerfile pattern (Python — recommendation-service)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
CMD ["gunicorn", "--chdir", "src", "-b", "0.0.0.0:8080", "app:app"]
```
Uses `gunicorn` instead of Flask's dev server — the same production-vs-dev
distinction you should apply to any language.

## Building locally (manual, before CI exists)

```bash
docker build -t localhost:5000/catalog-service:dev app/catalog-service
docker run --rm -p 8080:8080 localhost:5000/catalog-service:dev
curl localhost:8080/health
```

## Image tagging strategy used in this project

- `latest` — always the most recent build, convenient for local manual testing
- `<git-short-sha>` — immutable, what CI actually deploys (never redeploy
  `latest` via GitOps — always a SHA, so ArgoCD can tell two "versions" apart
  and you get real rollout history)

## Validating a Dockerfile without building (lint)

`ci/github-actions/.github/workflows/pr-checks.yml` runs `hadolint` on pull
requests — catches bad practices (e.g. missing `--no-cache-dir`, running as
root) before merge.
