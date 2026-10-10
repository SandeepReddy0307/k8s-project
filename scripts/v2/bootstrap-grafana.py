#!/usr/bin/env python3
"""Create a local Grafana credential without printing or persisting its value."""
import json
import secrets
import subprocess

context = "kind-streamflix-v2"
subprocess.run(["kubectl", "--context", context, "create", "namespace", "observability"], check=False)
exists = subprocess.run(["kubectl", "--context", context, "get", "secret", "grafana-admin", "-n", "observability"], capture_output=True)
if exists.returncode:
    secret = {"apiVersion": "v1", "kind": "Secret", "metadata": {"name": "grafana-admin", "namespace": "observability"}, "type": "Opaque", "stringData": {"admin-user": "admin", "admin-password": secrets.token_urlsafe(32)}}
    subprocess.run(["kubectl", "--context", context, "apply", "-f", "-"], input=json.dumps(secret), text=True, check=True)
print("Grafana admin Secret ready; credential value withheld.")
