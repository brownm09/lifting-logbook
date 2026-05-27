import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
// PrismaInstrumentation intentionally omitted: @prisma/instrumentation@5.22.0 bundles
// its own @opentelemetry/sdk-trace-base which is incompatible with the main app's
// OTel SDK version. When Prisma creates a tracing span during $connect(), it calls
// into its bundled SDK which receives a tracer from the main SDK and crashes with
// "parentTracer.getActiveSpanProcessor is not a function". Tracked in #348.

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
    instrumentations: [getNodeAutoInstrumentations()],
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
