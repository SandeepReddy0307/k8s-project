Promotes the complete set of application images built, scanned and attested by GitHub Actions. Images are pinned by digest in the environment manifest.

Validation: application security tests, Helm configuration gates and browser tests precede publication. Deployment is a separate approved environment job until Argo CD is enabled. Review migrations and rollback compatibility before merging.
