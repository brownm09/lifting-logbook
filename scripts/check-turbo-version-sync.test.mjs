import test from 'node:test';
import assert from 'node:assert/strict';

import { extractDockerfileTurboVersion, extractPackageJsonTurboVersion } from './check-turbo-version-sync.mjs';

test('extractDockerfileTurboVersion finds the pinned prune-step version', () => {
  const dockerfile = [
    'FROM node:20.11.1-alpine AS installer',
    'COPY . .',
    'RUN npx turbo@2.9.3 prune --scope=@lifting-logbook/web --docker',
  ].join('\n');

  assert.equal(extractDockerfileTurboVersion(dockerfile), '2.9.3');
});

test('extractDockerfileTurboVersion returns null when no pinned prune step is present', () => {
  const dockerfile = [
    'FROM node:20.11.1-alpine AS installer',
    'RUN npx turbo run build --filter=@lifting-logbook/web',
  ].join('\n');

  assert.equal(extractDockerfileTurboVersion(dockerfile), null);
});

test('extractPackageJsonTurboVersion reads devDependencies.turbo', () => {
  assert.equal(
    extractPackageJsonTurboVersion({ devDependencies: { turbo: '2.9.3' } }),
    '2.9.3',
  );
});

test('extractPackageJsonTurboVersion returns null when devDependencies is missing', () => {
  assert.equal(extractPackageJsonTurboVersion({}), null);
});

test('extractPackageJsonTurboVersion returns null when turbo is not a devDependency', () => {
  assert.equal(extractPackageJsonTurboVersion({ devDependencies: { typescript: '5.0.0' } }), null);
});
