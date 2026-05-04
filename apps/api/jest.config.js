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
    // Map workspace packages to their TypeScript source so tests always see
    // the in-tree version rather than the compiled dist in the root node_modules
    // (which is shared with the main checkout and may be stale in a worktree).
    '^@lifting-logbook/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@lifting-logbook/types$': '<rootDir>/../../packages/types/src/index.ts',
    // @src/core is a path alias used internally inside packages/core sources.
    '^@src/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@src/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
  },
};
