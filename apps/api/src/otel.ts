import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrismaInstrumentation } from '@prisma/instrumentation';

let sdk: NodeSDK | undefined;

export function startOtel(): NodeSDK | undefined {
  if (process.env.OTEL_SDK_DISABLED === 'true') return undefined;
  if (sdk) return sdk;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'lifting-logbook-api',
    traceExporter: new OTLPTraceExporter(endpoint ? { url: `${endpoint}/v1/traces` } : {}),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(endpoint ? { url: `${endpoint}/v1/metrics` } : {}),
    }),
    instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk?.shutdown().catch(() => undefined);
  });

  return sdk;
}

if (process.env.OTEL_SDK_AUTOSTART !== 'false') {
  startOtel();
}
