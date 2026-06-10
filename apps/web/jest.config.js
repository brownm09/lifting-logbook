const base = require('../../jest.config.base.js');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...base,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [...(base.setupFilesAfterEnv ?? []), '<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    // diagnostics.warnOnly: ts-jest emits TS compile errors as warnings rather
    // than aborting the suite. The @testing-library/jest-dom augmentation on
    // jest.Matchers (toBeInTheDocument, etc.) fails to resolve under Node10
    // moduleResolution in this monorepo setup — tracked in #421. Tests that
    // use those matchers run and pass at runtime (jest.setup.ts loads the lib);
    // the TS error is only at the type-check layer.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', diagnostics: { warnOnly: true } }],
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
