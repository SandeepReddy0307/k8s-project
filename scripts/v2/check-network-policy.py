#!/usr/bin/env python3
"""Verify cross-node allow/deny/allow traffic in a disposable kind namespace."""
import json
import subprocess

context = "kind-streamflix-v2"
namespace = "streamflix-v2-policy-check"

def kubectl(*args, check=True, **kwargs):
    return subprocess.run(["kubectl", "--context", context, *args], check=check, text=True, **kwargs)

if kubectl("get", "namespace", namespace, check=False, capture_output=True).returncode == 0:
    raise SystemExit("Policy-check namespace already exists; inspect it before running this check again.")
kubectl("create", "namespace", namespace)
try:
    pods = []
    for name, node, command in [("server", "streamflix-v2-worker", ["sh", "-c", "mkdir -p /tmp/www; echo policy-check-ok > /tmp/www/index.html; exec httpd -f -p 8080 -h /tmp/www"]), ("client", "streamflix-v2-worker2", ["sleep", "600"])]:
        pods.append({"apiVersion": "v1", "kind": "Pod", "metadata": {"name": name, "namespace": namespace, "labels": {"role": name}}, "spec": {"nodeName": node, "automountServiceAccountToken": False, "containers": [{"name": name, "image": "docker.io/library/busybox:1.38.0", "command": command}]}})
    kubectl("apply", "-f", "-", input=json.dumps({"apiVersion": "v1", "kind": "List", "items": pods}))
    kubectl("wait", "pod", "--all", "-n", namespace, "--for=condition=Ready", "--timeout=120s")
    address = kubectl("get", "pod", "server", "-n", namespace, "-o", "jsonpath={.status.podIP}", capture_output=True).stdout
    def request():
        return kubectl("exec", "client", "-n", namespace, "--", "wget", "-T", "3", "-qO-", f"http://{address}:8080", check=False, capture_output=True)
    assert request().stdout.strip() == "policy-check-ok", "Initial cross-node connection failed"
    policy = {"apiVersion": "networking.k8s.io/v1", "kind": "NetworkPolicy", "metadata": {"name": "server-ingress", "namespace": namespace}, "spec": {"podSelector": {"matchLabels": {"role": "server"}}, "policyTypes": ["Ingress"], "ingress": []}}
    kubectl("apply", "-f", "-", input=json.dumps(policy))
    import time
    deadline = time.monotonic() + 30
    while request().returncode == 0:
        if time.monotonic() >= deadline:
            raise AssertionError("NetworkPolicy did not block cross-node traffic")
        time.sleep(1)
    policy["spec"]["ingress"] = [{"from": [{"podSelector": {"matchLabels": {"role": "client"}}}], "ports": [{"protocol": "TCP", "port": 8080}]}]
    kubectl("apply", "-f", "-", input=json.dumps(policy))
    deadline = time.monotonic() + 30
    while request().stdout.strip() != "policy-check-ok":
        if time.monotonic() >= deadline:
            raise AssertionError("Explicit allow rule did not restore cross-node traffic")
        time.sleep(1)
    print("PASS: cross-node traffic allowed, blocked by policy, and restored by explicit allow.")
finally:
    kubectl("delete", "namespace", namespace, "--wait=false")
