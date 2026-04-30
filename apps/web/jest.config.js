const base = require('../../jest.config.base.js');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...base,
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@src/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@src/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
    '^@lifting-logbook/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@lifting-logbook/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
