/** @type {import('ts-jest').JestConfigWithTsJest} */
const nodeMajor = Number(process.versions.node.split('.')[0]);

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  transformIgnorePatterns: ['/node_modules/'],
  // Two independent win32-only mitigations, gated differently (#656):
  //
  // 1. testTimeout (ALL win32 Nodes) — under a full-suite `turbo run test`, several
  //    jest processes (web/core/types/api-client) run concurrently and oversubscribe
  //    the CPU, so a slow-but-healthy suite can intermittently blow past Jest's 5s
  //    default and report an isolation-only "1 failed" (#567). 15s of headroom absorbs
  //    the contention. This is CPU-oversubscription-driven, not Node-version-specific,
  //    so it applies on every win32 Node. Linux CI keeps the 5s default so a genuinely
  //    slow test there still fails fast.
  //
  // 2. workerIdleMemoryLimit + maxWorkers (Node >= 24 only) — Node 24 (Windows) workers
  //    exhausted heap when several CSV-fixture-heavy packages/core suites ran in parallel
  //    (#419); restarting idle workers above 512MB RSS and capping parallelism at 50% of
  //    CPU cleared the OOMs. Transpile-only ts-jest (#651) cut per-worker memory, so
  //    Node 20/22 no longer hit that OOM and can keep Jest's default parallelism
  //    (cpus - 1) without paying the worker-restart cost. Gated to nodeMajor >= 24 to
  //    restore full-CPU parallelism on supported Nodes; validated on Node 20 that lifting
  //    the cap does not reintroduce the #567 flakes (the testTimeout above still guards
  //    them). Linux CI is unaffected either way (not win32).
  ...(process.platform === 'win32'
    ? {
        testTimeout: 15000,
        ...(nodeMajor >= 24 ? { workerIdleMemoryLimit: '512MB', maxWorkers: '50%' } : {}),
      }
    : {}),
};
