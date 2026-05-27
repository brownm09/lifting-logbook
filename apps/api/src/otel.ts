import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
// A postinstall script in apps/api/package.json deletes @prisma/instrumentation's
// nested node_modules/@opentelemetry/ after every npm install, forcing resolution
// to the hoisted sdk-trace-base@2.7.1 and eliminating the v1/v2 tracer mismatch.
// See ADR-024 and issue #348.
import { PrismaInstrumentation } from '@prisma/instrumentation';

let sdk: NodeSDK | undefined;

export function startOtel(): NodeSDK | undefined {
  if (process.env.OTEL_SDK_DISABLED === 'true') return undefined;
  if (sdk) return sdk;

  // Exporters env-resolve OTEL_EXPORTER_OTLP_ENDPOINT (base) per the OTLP spec
  // and append /v1/traces or /v1/metrics; OTEL_EXPORTER_OTLP_TRACES_ENDPOINT or
  // OTEL_EXPORTER_OTLP_METRICS_ENDPOINT (full URL) override per-signal. Sampling
  // is controlled by OTEL_TRACES_SAMPLER / OTEL_TRACES_SAMPLER_ARG (defaults to
  // parentbased_always_on); ADR-018 covers the production sampling decision.
  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'lifting-logbook-api',
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
      }),
    ],
    instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()],
  });

  sdk.start();

  const shutdown = () => {
    sdk?.shutdown().catch(() => undefined);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

if (process.env.OTEL_SDK_AUTOSTART !== 'false') {
  try {
    startOtel();
  } catch (err) {
    // An OTel init failure must not kill the process — the app should start
    // without instrumentation rather than crash before NestJS can log anything.
    console.error('[otel] Failed to initialize OpenTelemetry SDK — continuing without instrumentation:', err);
  }
}
