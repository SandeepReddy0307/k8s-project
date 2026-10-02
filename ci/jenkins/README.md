# Jenkins on your VM

1. `docker compose up -d` (this file) on the VM.
2. Visit http://<vm-ip>:8080, unlock with the password in
   `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`.
3. Install suggested plugins + "Pipeline", "Docker Pipeline", "Git" plugins.
4. Create credentials:
   - `gitops-repo-creds` (username+PAT) for pushing to the GitOps repo.
5. Create a Pipeline job pointing at this repo's `ci/jenkins/Jenkinsfile`,
   with a `SERVICE` string parameter.
6. Make sure the VM can resolve/reach `localhost:5000` — if the registry runs
   on your laptop instead of the VM, replace `localhost:5000` with your
   laptop's LAN IP (e.g. `192.168.1.50:5000`) everywhere, and add it as an
   insecure registry in the VM's Docker daemon config.
7. (Optional) expose Jenkins to GitHub webhooks via `ngrok http 8080` so pushes
   to GitHub also trigger this pipeline automatically.
