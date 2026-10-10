'use strict';
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const sdk = new NodeSDK({traceExporter:new OTLPTraceExporter(),instrumentations:[getNodeAutoInstrumentations({'@opentelemetry/instrumentation-fs':{enabled:false}})]});
  sdk.start();
  process.once('SIGTERM',()=>sdk.shutdown().catch(()=>{}));
}
