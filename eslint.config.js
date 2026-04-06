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
];
