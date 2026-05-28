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
  console.log('[jest.global-setup] Starting postgres:16-alpine via Testcontainers...');
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('lifting_test')
    .withUsername('lifting')
    .withPassword('lifting')
    .start();

  const url = container.getConnectionUri();
  const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');

  console.log('[jest.global-setup] Running prisma migrate deploy...');
  execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  process.env.LIFTING_TC_DATABASE_URL = url;
  globalThis.__LL_PG_CONTAINER__ = container;
  console.log('[jest.global-setup] Postgres testcontainer ready.');
};
