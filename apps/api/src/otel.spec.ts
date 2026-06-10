import {
  DEPLOYMENT_ENVIRONMENT_ATTR,
  buildResourceAttributes,
  resolveDeploymentEnvironment,
} from './otel';

// Regression coverage for #487: the API must tag telemetry with a deployment
// environment so the production alert rules (infra/observability/alerts/api.yaml)
// can scope to prod and a staging 5xx never pages on the shared Grafana Cloud
// stack. These assertions lock the resource attribute the collector promotes to
// the `deployment_environment_name` Mimir label.
describe('resolveDeploymentEnvironment', () => {
  it('uses NODE_ENV verbatim when set', () => {
    expect(resolveDeploymentEnvironment('production')).toBe('production');
    expect(resolveDeploymentEnvironment('staging')).toBe('staging');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveDeploymentEnvironment('  staging  ')).toBe('staging');
  });

  it('falls back to "development" when the value is blank', () => {
    expect(resolveDeploymentEnvironment('')).toBe('development');
    expect(resolveDeploymentEnvironment('   ')).toBe('development');
  });

  it('reads process.env.NODE_ENV by default, falling back to "development" when unset', () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(resolveDeploymentEnvironment()).toBe('production');
      process.env.NODE_ENV = '';
      expect(resolveDeploymentEnvironment()).toBe('development');
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe('buildResourceAttributes', () => {
  it('sets the deployment.environment.name attribute from NODE_ENV', () => {
    expect(buildResourceAttributes('production')).toEqual({
      [DEPLOYMENT_ENVIRONMENT_ATTR]: 'production',
    });
  });

  it('uses the stable semconv attribute key', () => {
    expect(DEPLOYMENT_ENVIRONMENT_ATTR).toBe('deployment.environment.name');
  });
});
