import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCloudRunBody,
  extractConfigmapBlock,
  diffConfigs,
} from './check-otel-config-sync.mjs';

// Minimal fixtures exercising the two legitimate differences the check must
// normalize away: the Cloud Run file's leading comment header, and the
// configmap's 4-space block-scalar indentation. Kept small on purpose — the
// real files are compared by the CLI (`node scripts/check-otel-config-sync.mjs`).

const CLOUD_RUN = `# header comment line 1
# header comment line 2

extensions:
  health_check:
    endpoint: 0.0.0.0:13133

exporters:
  # inline comment kept in both
  otlphttp/logs:
    endpoint: \${env:OTEL_COLLECTOR_LOKI_ENDPOINT}
`;

const CONFIGMAP = `apiVersion: v1
kind: ConfigMap
metadata:
  name: x-config
data:
  OTEL_COLLECTOR_OTLP_ENDPOINT: "https://example"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: x-otelconfig
data:
  config.yaml: |
    extensions:
      health_check:
        endpoint: 0.0.0.0:13133

    exporters:
      # inline comment kept in both
      otlphttp/logs:
        endpoint: \${env:OTEL_COLLECTOR_LOKI_ENDPOINT}
`;

test('extractCloudRunBody strips the comment header and starts at extensions:', () => {
  const body = extractCloudRunBody(CLOUD_RUN);
  assert.match(body, /^extensions:/);
  assert.ok(!body.includes('header comment'));
});

test('extractConfigmapBlock dedents the config.yaml block to column 0', () => {
  const body = extractConfigmapBlock(CONFIGMAP);
  assert.match(body, /^extensions:/);
  // dedented: health_check nests two spaces, not six
  assert.ok(body.includes('\n  health_check:'));
  assert.ok(!body.includes('        endpoint')); // no residual 8-space indent
  // the first (non-otelconfig) ConfigMap doc must not leak into the block
  assert.ok(!body.includes('OTEL_COLLECTOR_OTLP_ENDPOINT'));
});

test('identical pipelines produce no diff', () => {
  assert.equal(
    diffConfigs(extractCloudRunBody(CLOUD_RUN), extractConfigmapBlock(CONFIGMAP)),
    null,
  );
});

test('inline-comment-only divergence is caught', () => {
  const drifted = CONFIGMAP.replace('# inline comment kept in both', '# edited on GKE only');
  const diff = diffConfigs(extractCloudRunBody(CLOUD_RUN), extractConfigmapBlock(drifted));
  assert.ok(diff);
  assert.match(diff.cloudRun, /kept in both/);
  assert.match(diff.configmap, /GKE only/);
});

test('a divergent value line is reported with its 1-based line number', () => {
  const drifted = CONFIGMAP.replace('0.0.0.0:13133', '0.0.0.0:9999');
  const diff = diffConfigs(extractCloudRunBody(CLOUD_RUN), extractConfigmapBlock(drifted));
  assert.ok(diff);
  assert.equal(diff.line, 3);
  assert.match(diff.cloudRun, /13133/);
  assert.match(diff.configmap, /9999/);
});

test('trailing-newline / CRLF differences do not read as drift', () => {
  const crlf = CLOUD_RUN.replace(/\n/g, '\r\n') + '\n\n';
  assert.equal(diffConfigs(extractCloudRunBody(crlf), extractConfigmapBlock(CONFIGMAP)), null);
});

test('missing config.yaml block throws', () => {
  assert.throws(() => extractConfigmapBlock('data:\n  other: 1\n'), /config\.yaml/);
});

test('all-comment Cloud Run file throws', () => {
  assert.throws(() => extractCloudRunBody('# only\n# comments\n'), /no config body/);
});
