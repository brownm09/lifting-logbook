import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
// @prisma/instrumentation@5.x directly instantiates sdk-trace-base's Span class,
// which was made package-private in sdk-trace-base@2.x — causing "Span is not a
// constructor" at $connect(). PrismaInstrumentation is excluded from the
// instrumentations array until the Prisma v6 upgrade. See ADR-024 and issue #348.

// OTel semantic-convention key for the deployment environment. Stable semconv
// uses `deployment.environment.name`; the OTLP→Prometheus translation in the
// collector promotes it to the Mimir label `deployment_environment_name`, which
// the production alert rules in infra/observability/alerts/api.yaml match on so
// staging telemetry (shared free-tier Grafana Cloud stack) never pages. See #487.
export const DEPLOYMENT_ENVIRONMENT_ATTR = 'deployment.environment.name';

/**
 * Resolve the deployment environment from NODE_ENV. The API container's NODE_ENV
 * is set per environment (`production` / `staging`) by the Helm values and the
 * Cloud Run service spec; locally it is unset, so we fall back to `development`.
 * Pure and exported so the resource attribute is unit-testable without starting
 * the SDK (#487 AC: "assertion that the resource attribute is set").
 */
export function resolveDeploymentEnvironment(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  return nodeEnv && nodeEnv.trim() !== '' ? nodeEnv.trim() : 'development';
}

/** Resource attributes carried by every span/metric/log this service emits. */
export function buildResourceAttributes(
  nodeEnv?: string,
): Record<string, string> {
  return { [DEPLOYMENT_ENVIRONMENT_ATTR]: resolveDeploymentEnvironment(nodeEnv) };
}

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
    resource: resourceFromAttributes(buildResourceAttributes()),
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
    // allow-skewed: SIGTERM/SIGINT shutdown handler — no business path to assert against.
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
