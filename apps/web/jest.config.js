const base = require('../../jest.config.base.js');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...base,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [...(base.setupFilesAfterEnv ?? []), '<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    // ts-jest runs transpile-only here: tsconfig.spec.json sets isolatedModules, so
    // each test file is transpiled without type-checking (fast — see issue #651).
    // This also sidesteps the #421 @testing-library/jest-dom matcher-augmentation
    // type error (previously softened with diagnostics.warnOnly): transpile-only emits
    // no type diagnostics from the test run at all. Tests still run and pass at runtime
    // (jest.setup.ts loads jest-dom).
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '\\.module\\.css$': 'identity-obj-proxy',
    '^@src/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@src/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
    '^@lifting-logbook/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
    '^@lifting-logbook/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@lifting-logbook/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
