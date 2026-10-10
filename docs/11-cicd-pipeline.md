# 11 — CI/CD pipeline (GitHub Actions, both registry paths)

This project uses **GitHub Actions** for CI, with two workflow variants so
you can compare the two registry options from `02-registry-choice.md`
hands-on.

## The shared pipeline shape (both workflows do the same steps)

1. Checkout code
2. Build Docker image
3. Push to registry
4. Update the image tag in the GitOps repo (this last step is what triggers
   ArgoCD — see `12-gitops-argocd.md`)

## The two workflows

Two workflow files, one per registry option (see `02-registry-choice.md`):
- `ci/github-actions/.github/workflows/ci.yml` — local registry, requires a
  **self-hosted runner** (`runs-on: self-hosted`) registered on your
  machine/VM:
  ```bash
  # following GitHub's own runner-registration wizard:
  # Repo Settings > Actions > Runners > New self-hosted runner
  ./config.sh --url https://github.com/<you>/streamflix-app --token <token>
  ./run.sh
  ```
- `ci/github-actions/.github/workflows/ci-dockerhub.yml` — Docker Hub,
  `runs-on: ubuntu-latest` (GitHub's free cloud runners, no setup needed).
  **Start here** — it needs nothing beyond a free Docker Hub account.

Both use a matrix strategy (one job per microservice, built in parallel) and
a path filter (`paths: app/**`) so pushing unrelated doc changes doesn't
trigger a full rebuild.

## Where each workflow actually executes (the thing that was confusing before)

| Step | `ci.yml` (local registry) | `ci-dockerhub.yml` (Docker Hub) |
|---|---|---|
| Runs on | your own machine/VM (self-hosted runner) | GitHub's cloud |
| Builds image | on your machine | on GitHub's cloud machine |
| Pushes to | `localhost:5000` (reachable because the runner IS on your machine) | Docker Hub (internet) |
| Updates GitOps repo | yes (git push with a PAT) | yes |

**Nothing runs "in the kind cluster" during CI** — the kind cluster is only
ever a **puller**, never a builder. This is intentional and mirrors real
production setups (build systems and runtime clusters are always separate).

## Branch/PR hygiene

`ci/github-actions/.github/workflows/pr-checks.yml` runs on every PR
(lint + hadolint + `helm template` + `yamllint`, no image push) — keeps
`main` protected without needing a full build on every WIP commit.

## Adding a second CI tool later (optional)

This project is set up to focus on GitHub Actions first. If you later want
to compare a second CI tool (e.g. Jenkins) against the same services, the
pattern to follow is identical: checkout → build → push → bump the image
tag in the GitOps repo → let ArgoCD take over. Nothing else in this project
needs to change to add that later.
