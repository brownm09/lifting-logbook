/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  // Node 24 (Windows) workers exhaust heap when several CSV-fixture-heavy
  // packages/core suites run in parallel. Restarting idle workers above 512MB
  // RSS and capping parallelism at 50% of CPU clears the OOMs locally. Scoped
  // to win32 so Node 20 Linux CI keeps Jest's default parallelism (cpus - 1)
  // and never pays the worker-restart cost. See #419 and CLAUDE.md's Node 24
  // caveat for the codified workaround.
  //
  // testTimeout is also raised on win32: under a full-suite `turbo run test`,
  // several jest processes (web/core/types/api-client) run concurrently and
  // oversubscribe the CPU, so a slow-but-healthy suite (e.g. the web CSV/onboarding
  // suites) can intermittently blow past Jest's 5s default and report an
  // isolation-only "1 failed" (#567). 15s of headroom absorbs the contention;
  // Linux CI keeps the 5s default so a genuinely slow test there still fails fast.
  ...(process.platform === 'win32'
    ? { workerIdleMemoryLimit: '512MB', maxWorkers: '50%', testTimeout: 15000 }
    : {}),
};
