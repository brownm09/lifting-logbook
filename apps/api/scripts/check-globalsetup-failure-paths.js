#!/usr/bin/env node
// Verifies the three failure paths in jest.global-setup.js without needing
// real Docker:
//
//   A. container.start() throws        → buildDockerUnavailableMessage headline,
//                                         no container stashed, teardown is no-op.
//   B. prisma migrate deploy throws    → buildMigrationFailedMessage headline,
//                                         container.stop() called once, handle
//                                         cleared, teardown is no-op (no second
//                                         stop).
//   C. LIFTING_SKIP_DB_E2E=foo (typo)  → near-miss warning, falls through; with
//                                         our stub of start() also throwing, we
//                                         then hit path A — confirms typoed
//                                         values do not silently skip.
//
// Repeatable: `node apps/api/scripts/check-globalsetup-failure-paths.js`.
// Exit 0 on all-pass, exit 1 with a diff-style report otherwise.
//
// This script monkey-patches require() for two modules and clears the require
// cache for jest.global-setup.js between scenarios. It does not touch the
// filesystem, network, or Docker. Linked from PR #423 review thread.

'use strict';

const Module = require('module');
const path = require('path');

const SETUP_PATH = path.resolve(__dirname, '..', 'jest.global-setup.js');
const TEARDOWN_PATH = path.resolve(__dirname, '..', 'jest.global-teardown.js');

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

// --- Test harness ----------------------------------------------------------

let stopCallCount = 0;
let lastWarn = [];
let lastLog = [];

function freshLoad(modulePath) {
  delete require.cache[modulePath];
  return require(modulePath);
}

function makeFakeContainer({ startThrows = false } = {}) {
  stopCallCount = 0;
  return {
    start: async () => {
      if (startThrows) {
        const err = new Error('connect ECONNREFUSED /var/run/docker.sock (simulated)');
        err.code = 'ECONNREFUSED';
        throw err;
      }
      return {
        getConnectionUri: () => 'postgresql://lifting:lifting@127.0.0.1:0/lifting_test',
        stop: async () => {
          stopCallCount += 1;
        },
      };
    },
  };
}

function installModuleMocks({ startThrows, migrateThrows }) {
  const originalResolve = Module._resolveFilename;
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, ...rest) {
    if (request === '@testcontainers/postgresql') {
      return {
        PostgreSqlContainer: class {
          constructor() {}
          withDatabase() { return this; }
          withUsername() { return this; }
          withPassword() { return this; }
          start() { return makeFakeContainer({ startThrows }).start(); }
        },
      };
    }
    if (request === 'child_process') {
      const real = originalLoad.call(this, request, parent, ...rest);
      return {
        ...real,
        execSync: (cmd, opts) => {
          if (migrateThrows && /prisma migrate deploy/.test(cmd)) {
            const err = new Error(
              'P3018: A migration failed to apply. New migrations cannot be applied (simulated).',
            );
            throw err;
          }
          return real.execSync(cmd, opts);
        },
      };
    }
    return originalLoad.call(this, request, parent, ...rest);
  };

  return () => {
    Module._resolveFilename = originalResolve;
    Module._load = originalLoad;
  };
}

function captureConsole() {
  const origWarn = console.warn;
  const origLog = console.log;
  lastWarn = [];
  lastLog = [];
  console.warn = (...args) => lastWarn.push(args.join(' '));
  console.log = (...args) => lastLog.push(args.join(' '));
  return () => {
    console.warn = origWarn;
    console.log = origLog;
  };
}

function clearEnv() {
  delete process.env.DATABASE_URL;
  delete process.env.LIFTING_SKIP_DB_E2E;
  delete process.env.LIFTING_TC_DATABASE_URL;
  delete globalThis.__LL_PG_CONTAINER__;
}

// --- Scenarios -------------------------------------------------------------

async function scenarioA_startThrows() {
  clearEnv();
  const restoreLoader = installModuleMocks({ startThrows: true, migrateThrows: false });
  const restoreConsole = captureConsole();
  let caught;
  try {
    const globalSetup = freshLoad(SETUP_PATH);
    await globalSetup();
  } catch (err) {
    caught = err;
  } finally {
    restoreConsole();
    restoreLoader();
  }

  record(
    'A.1 globalSetup throws when container.start() fails',
    caught instanceof Error,
    caught ? '' : 'no error thrown',
  );
  record(
    'A.2 headline is buildDockerUnavailableMessage',
    caught && caught.message.startsWith('[jest.global-setup] Cannot start Postgres via Testcontainers'),
    caught ? '' : 'no error to inspect',
  );
  record(
    'A.3 underlying error included in message',
    caught && caught.message.includes('ECONNREFUSED'),
  );
  record(
    'A.4 no container handle stashed on globalThis',
    globalThis.__LL_PG_CONTAINER__ === undefined,
    `handle = ${typeof globalThis.__LL_PG_CONTAINER__}`,
  );

  // Now confirm globalTeardown is a no-op (no throw, no second stop attempt).
  let teardownErr;
  try {
    const globalTeardown = freshLoad(TEARDOWN_PATH);
    await globalTeardown();
  } catch (err) {
    teardownErr = err;
  }
  record(
    'A.5 globalTeardown is a no-op after start-throw',
    teardownErr === undefined,
    teardownErr ? `threw: ${teardownErr.message}` : '',
  );
}

async function scenarioB_migrateThrows() {
  clearEnv();
  const restoreLoader = installModuleMocks({ startThrows: false, migrateThrows: true });
  const restoreConsole = captureConsole();
  let caught;
  try {
    const globalSetup = freshLoad(SETUP_PATH);
    await globalSetup();
  } catch (err) {
    caught = err;
  } finally {
    restoreConsole();
    restoreLoader();
  }

  record(
    'B.1 globalSetup throws when migrate deploy fails',
    caught instanceof Error,
    caught ? '' : 'no error thrown',
  );
  record(
    'B.2 headline is buildMigrationFailedMessage (NOT Docker-unreachable)',
    caught && caught.message.startsWith('[jest.global-setup] `prisma migrate deploy` failed'),
    caught ? `actual headline: ${caught.message.split('\n')[0]}` : '',
  );
  record(
    'B.3 message explicitly states Docker IS reachable',
    caught && caught.message.includes('Docker IS reachable'),
  );
  record(
    'B.4 container.stop() was called exactly once',
    stopCallCount === 1,
    `stop call count = ${stopCallCount}`,
  );
  record(
    'B.5 globalThis handle cleared to undefined',
    globalThis.__LL_PG_CONTAINER__ === undefined,
    `handle = ${typeof globalThis.__LL_PG_CONTAINER__}`,
  );

  const stopBeforeTeardown = stopCallCount;
  let teardownErr;
  try {
    const globalTeardown = freshLoad(TEARDOWN_PATH);
    await globalTeardown();
  } catch (err) {
    teardownErr = err;
  }
  record(
    'B.6 globalTeardown is a no-op after migrate-throw (no double-stop, no throw)',
    teardownErr === undefined && stopCallCount === stopBeforeTeardown,
    teardownErr
      ? `threw: ${teardownErr.message}`
      : stopCallCount !== stopBeforeTeardown
        ? `stop called again (count went ${stopBeforeTeardown} → ${stopCallCount})`
        : '',
  );
}

async function scenarioC_typoedSkipVar() {
  clearEnv();
  process.env.LIFTING_SKIP_DB_E2E = 'on'; // not in {1, true, yes}
  // Have start() throw too — so if typo silently skipped, we'd return cleanly;
  // if it falls through, we throw the Docker-unavailable error.
  const restoreLoader = installModuleMocks({ startThrows: true, migrateThrows: false });
  const restoreConsole = captureConsole();
  let caught;
  try {
    const globalSetup = freshLoad(SETUP_PATH);
    await globalSetup();
  } catch (err) {
    caught = err;
  } finally {
    restoreConsole();
    restoreLoader();
  }

  record(
    'C.1 typoed skip value does NOT silently skip — falls through to hard-fail',
    caught instanceof Error && caught.message.includes('Cannot start Postgres'),
    caught ? '' : 'no throw — silent skip regression',
  );
  record(
    'C.2 near-miss warning was emitted before falling through',
    lastWarn.some((line) => line.includes('not a recognized truthy value')),
    `warnings: ${JSON.stringify(lastWarn)}`,
  );

  // And the accepted variants should actually skip:
  for (const value of ['1', 'true', 'TRUE', 'yes']) {
    clearEnv();
    process.env.LIFTING_SKIP_DB_E2E = value;
    const restoreLoader2 = installModuleMocks({ startThrows: true, migrateThrows: false });
    const restoreConsole2 = captureConsole();
    let err;
    try {
      const globalSetup = freshLoad(SETUP_PATH);
      await globalSetup();
    } catch (e) {
      err = e;
    } finally {
      restoreConsole2();
      restoreLoader2();
    }
    record(
      `C.3 LIFTING_SKIP_DB_E2E=${value} skips cleanly (no throw)`,
      err === undefined,
      err ? `threw: ${err.message.split('\n')[0]}` : '',
    );
  }
}

// --- Run -------------------------------------------------------------------

(async () => {
  console.log('Exercising jest.global-setup.js failure paths (mocked Docker + execSync)...\n');
  await scenarioA_startThrows();
  console.log('');
  await scenarioB_migrateThrows();
  console.log('');
  await scenarioC_typoedSkipVar();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length) {
    console.log('\nFAILED checks:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
    process.exit(1);
  }
})();
