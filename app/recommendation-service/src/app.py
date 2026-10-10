import os, json, hashlib, logging, time
import requests, redis
from flask import Flask, jsonify, Response, request
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

def required(name):
    value = os.environ.get(name)
    if not value: raise RuntimeError(f'Missing configuration: {name}')
    return value
app = Flask(__name__)
if os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT'):
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.flask import FlaskInstrumentor
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    from opentelemetry.instrumentation.redis import RedisInstrumentor
    provider=TracerProvider(resource=Resource.create({'service.name':'recommendation-service'}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    FlaskInstrumentor().instrument_app(app)
    RequestsInstrumentor().instrument()
    RedisInstrumentor().instrument()
CATALOG_URL = required('CATALOG_URL')
r = redis.Redis.from_url(required('REDIS_URL'), password=required('REDIS_PASSWORD'), decode_responses=True, socket_timeout=3, socket_connect_timeout=3)
reco_requests = Counter('recommendation_requests_total', 'Recommendations requested')
@app.get('/health')
def health(): return jsonify(status='ok')
@app.get('/ready')
def ready():
    try: r.ping(); return jsonify(status='ready')
    except redis.RedisError: return jsonify(status='unavailable'), 503
@app.get('/metrics')
def metrics(): return Response(generate_latest(), content_type=CONTENT_TYPE_LATEST)
@app.get('/recommendations/<user>')
def recommendations(user):
    # Recommendations contain public catalog data only; private state stays in user-service.
    reco_requests.inc()
    if len(user)>254: return jsonify(error='invalid-user'),400
    cache_key='reco:'+hashlib.sha256(user.encode()).hexdigest()
    try:
        cached=r.get(cache_key)
        if cached: return jsonify(source='cache',titles=json.loads(cached))
        resp=requests.get(f'{CATALOG_URL}/titles',timeout=5);resp.raise_for_status()
        titles=resp.json(); titles.sort(key=lambda t:hashlib.sha256(f'{user}:{t["id"]}'.encode()).hexdigest())
        picked=titles[:6];r.setex(cache_key,120,json.dumps(picked))
        return jsonify(source='catalog',titles=picked)
    except (redis.RedisError, requests.RequestException, ValueError):
        return jsonify(error='recommendations-unavailable'),503
http_requests=Counter('http_requests_total','HTTP requests',['service','method','route','status'])
http_duration=Histogram('http_request_duration_seconds','HTTP latency',['service','method','route','status'])
@app.before_request
def timing(): request.started_at=time.monotonic()
@app.after_request
def headers(response):
    if request.path not in ['/health','/ready','/metrics']:
        labels={'service':'recommendation-service','method':request.method,'route':request.url_rule.rule if request.url_rule else 'unmatched','status':str(response.status_code)}
        http_requests.labels(**labels).inc()
        http_duration.labels(**labels).observe(time.monotonic()-request.started_at)
    response.headers['X-Content-Type-Options']='nosniff'
    return response
@app.errorhandler(Exception)
def errors(error):
    logging.error('recommendation-request-failed')
    return jsonify(error='service-unavailable'),503
