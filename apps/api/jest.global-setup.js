// Jest globalSetup — provisions a Postgres instance for the DB E2E suite.
//
// Two paths:
//   1. CI (or any env that already exports DATABASE_URL): passthrough — re-expose
//      the existing URL via LIFTING_TC_DATABASE_URL so the spec can pick it up
//      without bypassing the env-isolation Proxy in jest.env.setup.js.
//   2. Local: start an ephemeral postgres:16-alpine container via Testcontainers
//      (matches CI image), run `prisma migrate deploy` against it, and stash the
//      container handle on globalThis for teardown.
//
// In both cases the spec reads LIFTING_TC_DATABASE_URL (not DATABASE_URL) because
// jest.env.setup.js force-blanks DATABASE_URL in every worker to keep the
// in-memory e2e suite wiring InMemoryRepositoryFactory. The DB E2E spec restores
// DATABASE_URL from the sentinel inside its own beforeAll; jest.env.setup.js
// allows that one specific write through its Proxy.

const path = require('path');
const { execSync } = require('child_process');

// Pinned to a digest so local and CI runs are byte-identical. Keep this in sync
// with .github/workflows/ci.yml's postgres service image. To update: pull the
// latest postgres:16-alpine, capture its digest, and update both call sites.
const POSTGRES_IMAGE = 'postgres:16-alpine@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229';
const MIGRATION_TIMEOUT_MS = 120_000;

module.exports = async function globalSetup() {
  if (process.env.DATABASE_URL) {
    process.env.LIFTING_TC_DATABASE_URL = process.env.DATABASE_URL;
    // Clear DATABASE_URL so worker setupFiles' BLOCK list takes effect uniformly.
    // The spec restores it from LIFTING_TC_DATABASE_URL in beforeAll.
    delete process.env.DATABASE_URL;
    console.log('[jest.global-setup] CI passthrough — using pre-set DATABASE_URL.');
    return;
  }

  const { PostgreSqlContainer } = require('@testcontainers/postgresql');
  console.log(`[jest.global-setup] Starting ${POSTGRES_IMAGE} via Testcontainers...`);
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('lifting_test')
    .withUsername('lifting')
    .withPassword('lifting')
    .start();

  // Stash the handle before running migrations so globalTeardown can stop the
  // container even if migration fails (otherwise the started container would
  // leak — Ryuk cleanup is not guaranteed on every Docker Desktop config).
  globalThis.__LL_PG_CONTAINER__ = container;

  const url = container.getConnectionUri();
  const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');

  console.log('[jest.global-setup] Running prisma migrate deploy...');
  try {
    execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
      timeout: MIGRATION_TIMEOUT_MS,
    });
  } catch (err) {
    await container.stop().catch(() => {});
    globalThis.__LL_PG_CONTAINER__ = undefined;
    throw err;
  }

  process.env.LIFTING_TC_DATABASE_URL = url;
  console.log('[jest.global-setup] Postgres testcontainer ready.');
};
