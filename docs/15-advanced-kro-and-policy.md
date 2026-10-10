# 15 — Advanced: kro (Kube Resource Orchestrator) and policy

## kro — composing multiple K8s resources into one custom API

[`kro`](https://kro.run) lets you define a `ResourceGraphDefinition` that
bundles several raw K8s resources behind one simple Custom Resource — so
instead of a developer needing to know about a Deployment + Service + HPA +
ServiceMonitor + PDB all separately, they create **one** custom object and
kro expands it into all of them.

`gitops/infra-manifests/kro/rgd.yaml` defines a
`MicroserviceApp` kind that expands into exactly that bundle:
```yaml
apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata: { name: microservice-app }
spec:
  schema:
    apiVersion: v1alpha1
    kind: MicroserviceApp
    spec:
      name: string
      image: string
      port: integer | default=8080
      replicas: integer | default=2
  resources:
    - id: deployment
      template:
        apiVersion: apps/v1
        kind: Deployment
        metadata: { name: ${schema.spec.name} }
        spec:
          replicas: ${schema.spec.replicas}
          template:
            spec:
              containers:
                - name: ${schema.spec.name}
                  image: ${schema.spec.image}
                  ports: [{ containerPort: ${schema.spec.port} }]
    - id: service
      template:
        apiVersion: v1
        kind: Service
        metadata: { name: ${schema.spec.name} }
        spec:
          selector: { app: ${schema.spec.name} }
          ports: [{ port: ${schema.spec.port} }]
    - id: hpa
      template:
        apiVersion: autoscaling/v2
        kind: HorizontalPodAutoscaler
        metadata: { name: ${schema.spec.name} }
        spec:
          scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: ${schema.spec.name} }
          minReplicas: 2
          maxReplicas: 5
          metrics: [{ type: Resource, resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } } }]
```
Install the kro controller, apply the RGD, then spin up a brand-new demo
service with a single, tiny manifest
(`gitops/infra-manifests/kro/instance-example.yaml`):
```yaml
apiVersion: kro.run/v1alpha1
kind: MicroserviceApp
metadata: { name: demo-app-via-kro, namespace: streamflix }
spec:
  name: demo-app-via-kro
  image: localhost:5000/billing-service:latest
  port: 8080
  replicas: 2
```
```bash
kubectl apply -f gitops/infra-manifests/kro/rgd.yaml
kubectl apply -f gitops/infra-manifests/kro/instance-example.yaml
kubectl get microserviceapp,deploy,svc,hpa -n streamflix -l app=demo-app-via-kro
```
This is the same underlying idea as a Helm chart (a template that expands
into several resources), but expressed as a **native Kubernetes API/CRD**
instead of a client-side templating tool — worth comparing directly against
how `gitops/charts/*` does the same job via Helm.

## Why this is listed as "advanced" / optional

kro is a newer project (2024+) and not yet something you're likely to meet
in most existing jobs — it's included here specifically because the user
asked for the broadest possible concept coverage, not because it's assumed
knowledge. If you only have time for one thing from this doc, understanding
*why* it exists (templating/composition done as a first-class K8s API
rather than a separate CLI tool) matters more than memorizing its syntax.

## Policy-as-code recap

Kyverno (admission-time enforcement) is covered in depth in
`10-security-rbac-netpol-certs.md` — this doc only adds kro since the two
are often mentioned in the same "newer CNCF ecosystem tools" breath, but
solve unrelated problems (composition vs. enforcement).
