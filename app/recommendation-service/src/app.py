import os
import random
import requests
import redis
from flask import Flask, jsonify, request, Response
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST

app = Flask(__name__)
CATALOG_URL = os.environ.get("CATALOG_URL", "http://catalog-service:8080")
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, socket_connect_timeout=2)
reco_requests = Counter("recommendation_requests_total", "Total recommendation requests")


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.get("/ready")
def ready():
    try:
        r.ping()
        return jsonify(status="ready")
    except Exception as e:
        return jsonify(status="redis-unavailable", error=str(e)), 503


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)


@app.get("/recommendations/<user>")
def recommendations(user):
    reco_requests.inc()
    cache_key = f"reco:{user}"
    cached = r.get(cache_key)
    if cached:
        return jsonify(user=user, source="cache", titles=cached.split(","))

    try:
        resp = requests.get(f"{CATALOG_URL}/titles", timeout=3)
        titles = [t["name"] for t in resp.json()]
    except Exception:
        titles = ["Cluster Wars", "The Pod Whisperer"]

    random.shuffle(titles)
    picked = titles[:2]
    r.setex(cache_key, 60, ",".join(picked))
    return jsonify(user=user, source="catalog", titles=picked)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
