import { registerOTel } from '@vercel/otel';

// Tag web telemetry with the deployment environment so it is distinguishable
// from production in the shared free-tier Grafana Cloud stack, mirroring the API
// (apps/api/src/otel.ts). NODE_ENV is set per environment by the Helm values and
// the Cloud Run service spec; locally it falls back to `development`. See #487.
function resolveDeploymentEnvironment(): string {
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv && nodeEnv.trim() !== '' ? nodeEnv.trim() : 'development';
}

export function register() {
  registerOTel({
    serviceName: 'lifting-logbook-web',
    attributes: {
      'deployment.environment.name': resolveDeploymentEnvironment(),
    },
  });
}
