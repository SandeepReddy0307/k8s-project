# Sealed Secrets workflow

1. Install the controller (done by scripts/02-install-core-infra.sh).
2. Install the `kubeseal` CLI locally.
3. Fetch the controller's public cert (works even offline, no cluster access needed afterwards):
   kubeseal --fetch-cert --controller-namespace=kube-system > pub-cert.pem
4. Seal a secret:
   kubectl create secret generic postgres-credentials \
     --from-literal=username=postgres --from-literal=password=S3cureP@ss \
     --namespace streamflix --dry-run=client -o yaml \
     | kubeseal --format=yaml --cert=pub-cert.pem > postgres-credentials-sealed.yaml
5. Commit postgres-credentials-sealed.yaml to the gitops repo (safe: only the
   controller in YOUR cluster can decrypt it). Apply it or let ArgoCD sync it.
6. Delete the plain-text version in gitops/charts/_secrets/ once migrated.
