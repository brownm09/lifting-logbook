// Jest globalSetup — provisions a Postgres instance for the DB E2E suite.
//
// Three paths:
//   1. CI (or any env that already exports DATABASE_URL): passthrough — re-expose
//      the existing URL via LIFTING_TC_DATABASE_URL so the spec can pick it up
//      without bypassing the env-isolation Proxy in jest.env.setup.js.
//   2. Explicit local opt-out (LIFTING_SKIP_DB_E2E=1): skip provisioning entirely;
//      the DB E2E spec's describeOrSkip will leave its blocks pending. Contract:
//      this escape hatch is only valid when the diff under test touches no DB
//      code (prisma schema, migrations, repositories). See issue #394.
//   3. Local: start an ephemeral postgres:16-alpine container via Testcontainers
//      (matches CI image), run `prisma migrate deploy` against it, and stash the
//      container handle on globalThis for teardown. On any failure (Docker
//      unreachable, image pull error, migration error) we throw an actionable
//      multi-line error so the api workspace test run aborts with a clear cause
//      — never a raw Testcontainers stack trace.
//
// In paths 1 and 3 the spec reads LIFTING_TC_DATABASE_URL (not DATABASE_URL)
// because jest.env.setup.js force-blanks DATABASE_URL in every worker to keep
// the in-memory e2e suite wiring InMemoryRepositoryFactory. The DB E2E spec
// restores DATABASE_URL from the sentinel inside its own beforeAll;
// jest.env.setup.js allows that one specific write through its Proxy.

const path = require('path');
const { execSync } = require('child_process');

// Pinned to a digest so local and CI runs are byte-identical. Keep this in sync
// with .github/workflows/ci.yml's postgres service image. To update: pull the
// latest postgres:16-alpine, capture its digest, and update both call sites.
const POSTGRES_IMAGE = 'postgres:16-alpine@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229';
const MIGRATION_TIMEOUT_MS = 120_000;

function buildDockerUnavailableMessage(underlying) {
  return [
    '[jest.global-setup] Cannot start Postgres via Testcontainers — Docker appears unreachable.',
    '',
    'Recovery options:',
    '  1. Fix Docker Desktop (see issue #394 for the WSL distro reset procedure).',
    '  2. Set DATABASE_URL=postgresql://lifting:lifting@localhost:5433/lifting_test',
    '     after `docker-compose -f docker-compose.test.yml up -d`.',
    '  3. If your change does NOT touch apps/api/prisma or any DB repository,',
    '     set LIFTING_SKIP_DB_E2E=1 to skip the DB suite for this run.',
    '',
    `Underlying error: ${underlying && underlying.message ? underlying.message : String(underlying)}`,
  ].join('\n');
}

module.exports = async function globalSetup() {
  if (process.env.DATABASE_URL) {
    process.env.LIFTING_TC_DATABASE_URL = process.env.DATABASE_URL;
    // Clear DATABASE_URL so worker setupFiles' BLOCK list takes effect uniformly.
    // The spec restores it from LIFTING_TC_DATABASE_URL in beforeAll.
    delete process.env.DATABASE_URL;
    console.log('[jest.global-setup] CI passthrough — using pre-set DATABASE_URL.');
    return;
  }

  if (process.env.LIFTING_SKIP_DB_E2E === '1') {
    console.warn(
      '[jest.global-setup] LIFTING_SKIP_DB_E2E=1 — skipping DB E2E provisioning. ' +
        'DB-touching changes will not be locally verified. See issue #394.',
    );
    // Intentionally do not set LIFTING_TC_DATABASE_URL — the spec's
    // describeOrSkip will leave its blocks pending.
    return;
  }

  const { PostgreSqlContainer } = require('@testcontainers/postgresql');
  console.log(`[jest.global-setup] Starting ${POSTGRES_IMAGE} via Testcontainers...`);

  let container;
  try {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase('lifting_test')
      .withUsername('lifting')
      .withPassword('lifting')
      .start();
  } catch (err) {
    // Container.start() failed before we could stash a handle — most commonly
    // because the Docker daemon is unreachable. Surface the actionable message
    // so the failure is self-explanatory.
    throw new Error(buildDockerUnavailableMessage(err));
  }

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
    throw new Error(buildDockerUnavailableMessage(err));
  }

  process.env.LIFTING_TC_DATABASE_URL = url;
  console.log('[jest.global-setup] Postgres testcontainer ready.');
};
