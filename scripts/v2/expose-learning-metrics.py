#!/usr/bin/env python3
"""Expose metrics inside the local Docker network only; never target production."""
import json
import subprocess
import yaml

context = "kind-streamflix-v2"
node = "streamflix-v2-control-plane"
subprocess.run(["kubectl", "--context", context, "cluster-info"], check=True, stdout=subprocess.DEVNULL)
for component in ["kube-controller-manager", "kube-scheduler"]:
    subprocess.run(["docker", "exec", node, "sed", "-i", "s/--bind-address=127.0.0.1/--bind-address=0.0.0.0/g", f"/etc/kubernetes/manifests/{component}.yaml"], check=True)
subprocess.run(["docker", "exec", node, "sed", "-i", "s#--listen-metrics-urls=http://127.0.0.1:2381#--listen-metrics-urls=http://0.0.0.0:2381#g", "/etc/kubernetes/manifests/etcd.yaml"], check=True)
import time
deadline = time.monotonic() + 180
while subprocess.run(["kubectl", "--context", context, "get", "--raw", "/readyz", "--request-timeout=5s"], capture_output=True).returncode:
    if time.monotonic() > deadline:
        raise SystemExit("API did not return after local metrics configuration")
    time.sleep(2)
deadline = time.monotonic() + 180
while True:
    result = subprocess.run(["kubectl", "--context", context, "get", "configmap", "kube-proxy", "-n", "kube-system", "-o", "json", "--request-timeout=5s"], text=True, capture_output=True)
    if result.returncode == 0:
        break
    if time.monotonic() > deadline:
        raise SystemExit("Unable to read kube-proxy configuration after API restart")
    time.sleep(2)
config = json.loads(result.stdout)
proxy = yaml.safe_load(config["data"]["config.conf"])
proxy["metricsBindAddress"] = "0.0.0.0:10249"
patch = {"data": {"config.conf": yaml.safe_dump(proxy)}}
subprocess.run(["kubectl", "--context", context, "patch", "configmap", "kube-proxy", "-n", "kube-system", "--type", "merge", "-p", json.dumps(patch)], check=True)
subprocess.run(["kubectl", "--context", context, "rollout", "restart", "daemonset/kube-proxy", "-n", "kube-system"], check=True)
subprocess.run(["kubectl", "--context", context, "rollout", "status", "daemonset/kube-proxy", "-n", "kube-system", "--timeout=180s"], check=True)
print("Local metrics listeners updated. These ports are not published to Windows.")
