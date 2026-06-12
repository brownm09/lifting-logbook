'use strict';

const { RuleTester } = require('eslint');
const test = require('node:test');

const rule = require('./no-direct-prisma-transaction');

const tsParser = require('@typescript-eslint/parser');

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
});

test('no-direct-prisma-transaction', () => {
  tester.run('no-direct-prisma-transaction', rule, {
    valid: [
      // Allowlisted: prisma-tx.util.ts may call $transaction directly.
      {
        code: 'await client.$transaction(ops);',
        filename: 'apps/api/src/adapters/prisma/prisma-tx.util.ts',
      },
      // Allowlisted: rls.interceptor.ts owns the per-request interactive transaction.
      {
        code: 'await prisma.$transaction(async (tx) => {});',
        filename: 'apps/api/src/adapters/prisma/rls.interceptor.ts',
      },
      // Allowlisted: rls-context.service.ts owns the per-operation short-lived transaction (#518).
      {
        code: 'await this.prisma.$transaction(async (tx) => {}, { timeout: 5000 });',
        filename: 'apps/api/src/adapters/prisma/rls-context.service.ts',
      },
      // Non-$transaction member calls are unaffected.
      {
        code: 'prisma.$connect();',
        filename: 'apps/api/src/adapters/prisma/some.repository.ts',
      },
      // Property access (typeof check) is not a CallExpression — not flagged.
      {
        code: "typeof (client as PrismaClient).$transaction === 'function'",
        filename: 'apps/api/src/adapters/prisma/some.repository.ts',
      },
    ],
    invalid: [
      // Direct $transaction call in a repository file must use runBatch/runInteractive instead.
      {
        code: 'await prisma.$transaction(async (tx) => { return tx.user.findMany(); });',
        filename: 'apps/api/src/adapters/prisma/training-max.repository.ts',
        errors: [{ messageId: 'noDirectTransaction' }],
      },
    ],
  });
});
