# Versioned log stack

Loki chart source: Grafana Community, chart 18.3.0. Loki image: 3.7.0. Learning mode uses one replica and a filesystem PVC. Production needs authenticated access, HA/object storage, retention, capacity planning and recovery tests.

```bash
helm repo add grafana-community https://grafana-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade --install loki-v2 grafana-community/loki --version 18.3.0 \
  -n observability-v2 --create-namespace \
  -f gitops/platform/observability-v2/loki-values.yaml --wait --timeout=10m
# Alloy chart 1.13.1 was rendered and validated with this configuration.
helm upgrade --install alloy-v2 grafana/alloy --version 1.13.1 -n observability-v2 \
  -f gitops/platform/observability-v2/alloy-values.yaml --wait --timeout=5m
kubectl apply -f gitops/platform/observability-v2/grafana-datasource.yaml
```

Configure Grafana's datasource sidecar to watch ConfigMaps in `observability` (or all permitted namespaces) with label `grafana_datasource=1`. Test the new datasource before switching defaults. Preserve the old Loki release/PVC and its datasource for historical logs. Existing Promtail/Fluent Bit can continue writing to the old Loki during transition; only Alloy writes to the new instance, preventing duplicate ingestion there.

Alloy uses the Kubernetes log API; its Helm chart provides service-account/RBAC resources. It does not require hostPath mounts or a Pod on every tainted worker. Verify `pods/log` and discovery permissions, API egress, and log retrieval for every namespace. One collector is a learning setup; production uses clustered collectors with an explicit load-distribution design and least-privilege discovery scope.

Sources: https://grafana.com/docs/loki/latest/setup/install/helm/install-monolithic/ and https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.kubernetes/ .
