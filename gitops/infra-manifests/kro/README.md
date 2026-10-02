# kro (Kube Resource Orchestrator)

kro lets you define a single custom API (a `ResourceGraphDefinition`) that
composes several native K8s resources together, so consumers create ONE
custom resource instead of hand-writing a Deployment+Service+HPA+Ingress
every time. This is a lightweight "mini platform engineering" exercise.

Install (local kind):
  helm install kro oci://ghcr.io/kro-run/kro/kro --namespace kro-system --create-namespace

Then apply rgd.yaml and instance-example.yaml below.
