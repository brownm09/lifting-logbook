/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  // Local Node 24 (Windows) workers exhaust heap when several CSV-fixture-heavy
  // packages/core suites run in parallel. Restarting idle workers above 512MB
  // RSS and capping parallelism at 50% of CPU keeps Node 20 CI behaviour
  // effectively unchanged while clearing the OOMs locally. See #419.
  workerIdleMemoryLimit: '512MB',
  maxWorkers: '50%',
};
