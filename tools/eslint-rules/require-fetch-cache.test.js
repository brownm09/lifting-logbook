'use strict';

const { RuleTester } = require('eslint');
const test = require('node:test');

const rule = require('./require-fetch-cache');

// RuleTester needs a TS-aware parser for the `as RequestInit` case. Resolved from the monorepo
// root devDependency (the eslint-rules workspace doesn't depend on it directly, matching
// no-uncovered-error-fallback.test.js).
const tsParser = require('@typescript-eslint/parser');

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
});

test('require-fetch-cache', () => {
  tester.run('require-fetch-cache', rule, {
    valid: [
      // Explicit cache directive present.
      "fetch(url, { cache: 'no-store' });",
      'fetch(url, { next: { revalidate: 60 } });',
      "fetch(url, { method: 'POST', cache: 'no-store', headers: h });",
      // Spread may carry cache/next at runtime (apiFetch/clientFetch wrapper shape).
      'fetch(url, { ...init, headers: h });',
      // TS assertion is unwrapped to find the object literal underneath.
      'fetch(url, { next: { revalidate: 3600 } } as RequestInit);',
      // Second argument is not an object literal — not statically inspectable, so not flagged.
      'fetch(url, init);',
      // Not a bare fetch() call.
      'client.fetch(url);',
    ],
    invalid: [
      // No options object at all.
      { code: 'fetch(url);', errors: [{ messageId: 'missing' }] },
      // Two-arg call whose options omit both cache and next — the gap the old selector missed.
      { code: "fetch(url, { method: 'POST' });", errors: [{ messageId: 'missing' }] },
      { code: 'fetch(url, { headers: h });', errors: [{ messageId: 'missing' }] },
    ],
  });
});
