// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin');

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
  // Enforce explicit fetch() cache semantics in apps/web Server Components.
  // Next.js changed the default fetch() caching behaviour between v14 and v15 — relying on
  // defaults is unsafe. See docs/standards/fetch-cache-semantics.md.
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="fetch"][arguments.length=1]',
          message:
            "fetch() calls must include an explicit cache option. Use { cache: 'no-store' } or { next: { revalidate: N } }. See docs/standards/fetch-cache-semantics.md.",
        },
      ],
    },
  },
];
