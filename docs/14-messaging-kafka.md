# 14 — Messaging: Kafka event streaming

## Why Kafka, and why it's architecturally different from the rest

Every other service in this project is **request/response** (a client calls
an HTTP endpoint and waits for a reply). Kafka introduces **asynchronous,
decoupled, event-driven** communication — the producer (`catalog-service`)
has zero knowledge of who (if anyone) consumes the events it publishes, and
doesn't wait for them to be processed. This is a fundamentally different
(and extremely common in real systems) integration pattern worth learning
distinctly from the Redis/Postgres request/response calls elsewhere.

## The flow in this project

```
user calls POST /api/catalog/titles/:id/view (via api-gateway)
  → catalog-service looks up the title in Postgres
    → publishes a "title-viewed" event to Kafka topic "title-viewed"
      (non-blocking: catalog-service responds to the HTTP caller immediately,
       does not wait for Kafka to confirm delivery to a consumer)
        → activity-tracker (separate Deployment, Kafka consumer group
          "activity-tracker-group") picks up the event independently
            → increments views:<title> in Redis
```
```bash
curl -X POST http://localhost:8080/api/catalog/titles/1/view
curl http://localhost:8080/api/activity/views/1
# {"title":"1","views":3}
```

## Why a StatefulSet for Kafka (not Deployment)

Kafka brokers need stable identity (`KAFKA_NODE_ID`, advertised listener
address) and a dedicated, durable commit log per broker —
`gitops/charts/kafka/templates/statefulset.yaml` runs a **single-node KRaft
broker+controller** (no separate ZooKeeper needed — KRaft is the modern
Kafka consensus mode, replacing ZooKeeper since Kafka 3.3+):
```yaml
env:
  - { name: KAFKA_NODE_ID, value: "1" }
  - { name: KAFKA_PROCESS_ROLES, value: "broker,controller" }
  - { name: KAFKA_LISTENERS, value: "PLAINTEXT://:9092,CONTROLLER://:9093" }
  - { name: KAFKA_ADVERTISED_LISTENERS, value: "PLAINTEXT://kafka:9092" }
  - { name: KAFKA_CONTROLLER_QUORUM_VOTERS, value: "1@kafka-0.kafka:9093" }
  - { name: KAFKA_CONTROLLER_LISTENER_NAMES, value: "CONTROLLER" }
```
Image: `apache/kafka:3.7.0` — the official Apache-maintained image (not
Bitnami's, which has been pulled from Docker Hub's free tier). This image's
env vars are `KAFKA_*` directly (matching `server.properties` keys
uppercased with underscores), unlike Bitnami's `KAFKA_CFG_*` convention —
double-check this if you've used Bitnami's chart before.

## Inspecting Kafka directly

```bash
kubectl exec -it kafka-0 -n streamflix -- /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

kubectl exec -it kafka-0 -n streamflix -- /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic title-viewed --from-beginning

kubectl exec -it kafka-0 -n streamflix -- /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group activity-tracker-group
# shows consumer lag — how far behind the consumer is from the latest produced offset
```

## A quirk you'll likely hit: "This server does not host this topic-partition"

Kafka auto-creates topics on **first publish**, not on consumer startup. If
`activity-tracker` starts before any event has ever been published, its
first subscribe attempt can briefly fail with this error. It self-heals via
normal `kafkajs` retry/backoff and Kubernetes' own pod-restart behavior —
no fix needed, but worth understanding why you might see it once in fresh
logs (see `app/activity-tracker/src/index.js`'s consumer error handling).

## NATS — the other messaging system in this project

`gitops/charts/nats/` runs NATS alongside Kafka specifically so you can
compare the two models: Kafka (durable log, replayable, consumer groups
track offsets) vs. NATS core pub/sub (fire-and-forget, no persistence by
default — much lower overhead for ephemeral signals). Neither replaces the
other; production systems often run both for different needs.

**Stretch exercise** (not pre-wired, left for you to build as hands-on
practice): add a NATS publish call in `notification-service` for an internal
"user logged in" broadcast, and a second lightweight subscriber service —
this reinforces the pub/sub pattern using a second, simpler broker than
Kafka's consumer-group model.
