# Secrets (plain, for first-run / learning only)

These plain Kubernetes Secret manifests exist ONLY so the cluster works on first
boot. In a real GitOps flow you should NEVER commit plain secrets to git.

Workflow to replace these with SealedSecrets (see ../infra-manifests/sealed-secrets):
  kubectl create secret generic postgres-credentials \
    --from-literal=username=postgres --from-literal=password=postgres \
    --namespace streamflix --dry-run=client -o yaml \
    | kubeseal --format=yaml --controller-namespace=kube-system > postgres-credentials-sealed.yaml

Then commit postgres-credentials-sealed.yaml instead of this file, and delete
this plain one from the gitops repo.
