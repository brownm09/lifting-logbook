// Unit tests for the Grafana endpoint single-source guard (#785).
// Run: node --test scripts/check-grafana-endpoint-sources.test.mjs
//
// These fixtures embed real endpoint literals to exercise the detector; this file
// is on the guard's ALLOWLIST so its own literals never trip a real-repo scan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findHardcodedEndpoints,
  isDocFile,
  isCommentLine,
  ENDPOINT_RE,
  SOURCE_FILE,
} from './check-grafana-endpoint-sources.mjs';

const OTLP = 'https://otlp-gateway-prod-us-east-3.grafana.net/otlp';
const LOKI = 'https://logs-prod-042.grafana.net/otlp';

test('flags a hardcoded OTLP endpoint on a live (non-comment) config line', () => {
  const files = [
    { path: '.github/workflows/deploy.yml', content: `          OTEL_OTLP_ENDPOINT="${OTLP}" \\` },
  ];
  const v = findHardcodedEndpoints(files);
  assert.equal(v.length, 1);
  assert.equal(v[0].path, '.github/workflows/deploy.yml');
  assert.equal(v[0].line, 1);
});

test('flags a hardcoded Loki endpoint on a Helm values line', () => {
  const files = [
    {
      path: 'infra/kubernetes/values/staging-otel-collector.yaml',
      content: `  OTEL_COLLECTOR_LOKI_ENDPOINT: ${LOKI}`,
    },
  ];
  assert.equal(findHardcodedEndpoints(files).length, 1);
});

test('allows the endpoint literal in the single source file', () => {
  const files = [{ path: SOURCE_FILE, content: `export OTEL_OTLP_ENDPOINT=${OTLP}` }];
  assert.deepEqual(findHardcodedEndpoints(files), []);
});

test('allows an endpoint reference inside a YAML/shell (#) comment', () => {
  const files = [
    {
      path: 'infra/kubernetes/values/staging-otel-collector.yaml',
      content: `  # the prior logs-prod-021.grafana.net value was the wrong stack`,
    },
  ];
  assert.deepEqual(findHardcodedEndpoints(files), []);
});

test('allows an endpoint reference inside a JS (//) comment', () => {
  const files = [{ path: 'scripts/example.mjs', content: `  //   ${OTLP}` }];
  assert.deepEqual(findHardcodedEndpoints(files), []);
});

test('allows endpoint values cited in documentation prose', () => {
  const files = [
    { path: 'docs/adr/ADR-018-observability-stack.md', content: `OTLP now points at ${OTLP}.` },
    { path: 'README.md', content: `Loki endpoint: ${LOKI}` },
  ];
  assert.deepEqual(findHardcodedEndpoints(files), []);
});

test('reports the correct 1-indexed line number for each violation', () => {
  const content = ['first line', `x=${OTLP}`, 'third line', `y=${LOKI}`].join('\n');
  const v = findHardcodedEndpoints([{ path: 'deploy.yml', content }]);
  assert.equal(v.length, 2);
  assert.equal(v[0].line, 2);
  assert.equal(v[1].line, 4);
});

test('ENDPOINT_RE matches the two guarded hosts but not other grafana hosts', () => {
  assert.match('otlp-gateway-prod-us-east-3.grafana.net', ENDPOINT_RE);
  assert.match('logs-prod-042.grafana.net', ENDPOINT_RE);
  // Mimir/prometheus host shape and the bare domain are intentionally not guarded.
  assert.doesNotMatch('prometheus-prod-01.grafana.net', ENDPOINT_RE);
  assert.doesNotMatch('grafana.net', ENDPOINT_RE);
});

test('isDocFile / isCommentLine helpers behave as documented', () => {
  assert.ok(isDocFile('docs/adr/x.md'));
  assert.ok(isDocFile('anything.md'));
  assert.ok(!isDocFile('.github/workflows/deploy.yml'));
  assert.ok(isCommentLine('   # yaml comment'));
  assert.ok(isCommentLine('  // js comment'));
  assert.ok(!isCommentLine('OTEL_OTLP_ENDPOINT=1  # trailing comment is still live config'));
});
