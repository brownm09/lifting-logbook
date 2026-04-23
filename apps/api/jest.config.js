/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    // @src/core is a pre-existing path alias inside @lifting-logbook/core sources.
    // Map it so jest can resolve transitive imports when a test loads core.
    '^@src/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@src/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
  },
};
