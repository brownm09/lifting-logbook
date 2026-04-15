// @ts-check

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // Inherit root TypeScript rules
  ...require('../../eslint.config.js'),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Enforce the hexagonal architecture boundary defined in ADR-002.
      // packages/core is pure domain logic — it must never import from app
      // workspaces or infrastructure packages. Violations mean the dependency
      // rule is inverted; use a port interface instead.
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '@lifting-logbook/api',
              '@lifting-logbook/api-legacy',
              '@lifting-logbook/web',
              '@lifting-logbook/mobile',
            ],
            message:
              'packages/core must not import from app workspaces. ' +
              'Dependency must flow inward (ADR-002).',
          },
          {
            group: [
              '@prisma/client',
              'prisma',
              'typeorm',
              'sequelize',
              'knex',
              'drizzle-orm',
              'mongoose',
              'pg',
              'postgres',
              'mysql2',
              'mysql',
              'sqlite3',
              'better-sqlite3',
              'redis',
              'ioredis',
            ],
            message:
              'packages/core must not import database or ORM packages. ' +
              'Use a port interface instead (ADR-002).',
          },
          {
            group: [
              'express',
              'fastify',
              '@nestjs/*',
              'koa',
              '@hapi/hapi',
            ],
            message:
              'packages/core must not import HTTP server frameworks. ' +
              'These belong in the adapter layer (ADR-002).',
          },
          {
            group: [
              'axios',
              'node-fetch',
              'got',
              'cross-fetch',
              'undici',
              'superagent',
            ],
            message:
              'packages/core must not import HTTP client libraries. ' +
              'Use a port interface instead (ADR-002).',
          },
          {
            group: [
              'passport',
              'passport-*',
              'jsonwebtoken',
              'bcrypt',
              'bcryptjs',
              'argon2',
            ],
            message:
              'packages/core must not import auth libraries. ' +
              'Use a port interface instead (ADR-002).',
          },
          {
            group: [
              '@google-cloud/*',
              '@aws-sdk/*',
              'aws-sdk',
              '@azure/*',
            ],
            message:
              'packages/core must not import cloud SDK packages. ' +
              'These belong in the adapter layer (ADR-002).',
          },
        ],
      }],
    },
  },
  // TODO(#52): Remove once GAS-era code is re-typed under issue #52.
  // These directories were migrated from the Google Apps Script codebase and use
  // `any` for spreadsheet data structures (mixed-type row arrays). Proper types
  // require a dedicated cleanup pass; suppress here to keep CI green in the interim.
  {
    files: ['src/models/**/*.ts', 'src/services/**/*.ts', 'src/utils/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
