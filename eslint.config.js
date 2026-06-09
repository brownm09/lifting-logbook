// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const localRules = require('./tools/eslint-rules');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'],
  },
  // flat/recommended includes the @typescript-eslint parser and recommended rules
  // scoped to **/*.ts | **/*.tsx | **/*.mts | **/*.cts
  ...tsPlugin.configs['flat/recommended'],
  // Allow underscore-prefixed names as the conventional "intentionally unused" marker.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Enforce explicit fetch() cache semantics in apps/web. Next.js changed the default fetch()
  // caching behaviour between v14 and v15 — relying on defaults is unsafe. The custom rule
  // catches both zero/one-argument calls AND two-argument calls whose options object omits
  // both `cache` and `next` (the old `no-restricted-syntax` selector matched only
  // single-argument calls, leaving `fetch(url, { method: 'POST' })` uncovered).
  // See docs/standards/fetch-cache-semantics.md.
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx'],
    plugins: {
      'lifting-logbook': localRules,
    },
    rules: {
      'lifting-logbook/require-fetch-cache': 'error',
    },
  },
  // Enforce test coverage for error-swallowing fallbacks in Server Components and
  // API route handlers. See docs/standards/error-fallback-test-coverage.md and
  // tools/eslint-rules/no-uncovered-error-fallback.js.
  {
    files: ['apps/web/app/**/*.ts', 'apps/web/app/**/*.tsx', 'apps/api/src/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx'],
    plugins: {
      'lifting-logbook': localRules,
    },
    rules: {
      'lifting-logbook/no-uncovered-error-fallback': 'error',
    },
  },
];
