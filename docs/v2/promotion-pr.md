Promotes the complete set of application images built and scanned by GitHub Actions and published to Docker Hub with BuildKit SBOM/provenance attestations. Images are pinned by digest in the environment manifest.

Validation: application security tests, Helm configuration gates and browser tests precede publication. Deployment is a separate approved environment job until Argo CD is enabled. Review migrations and rollback compatibility before merging.
