// Prevent Prisma's bundled dotenv from polluting the test environment.
//
// When @prisma/client is first imported, its runtime library loads apps/api/.env
// via a bundled dotenv, setting CLERK_SECRET_KEY and DATABASE_URL into process.env.
// This happens at module-evaluation time (during the import chain that starts when
// programs.e2e.spec.ts is loaded), AFTER this setupFiles script runs.
//
// Strategy:
//   1. Pre-set blocked keys to '' in the real process.env (so hasOwnProperty returns
//      true — Prisma's dotenv skips keys that are already "owned").
//   2. Wrap process.env in a Proxy whose set trap discards writes to blocked keys.
//      This is the fallback in case any path assigns directly without checking hasOwnProperty.
//
// Note: Object.defineProperty(process.env, key, {get, set}) does NOT work in
// Node.js 20 — it throws ERR_INVALID_OBJECT_DEFINE_PROPERTY. The Proxy approach
// is the only reliable mechanism.
//
// With CLERK_SECRET_KEY = '' (falsy):
//   - auth.module.ts: '' ? ClerkAuthProvider : DevAuthProvider → DevAuthProvider ✓
//   - auth.module.ts guard: '' === '' AND NODE_ENV !== 'test' → false → no throw ✓
// With DATABASE_URL = '' (falsy):
//   - describeOrSkip helper: !!'' → false → DB-only describe blocks skip ✓
// With DEV_USER_ID / DEV_USER_EMAIL = '':
//   - DevAuthProvider: uses the Bearer token value as user ID (expected by tests) ✓

const BLOCK = [
  'CLERK_SECRET_KEY',
  'DATABASE_URL',
  'SYSTEM_DATABASE_URL',
  'USER_DATA_DATABASE_URL',
  'DEV_USER_ID',
  'DEV_USER_EMAIL',
];

for (const key of BLOCK) {
  process.env[key] = '';
}

const originalEnv = process.env;
process.env = new Proxy(originalEnv, {
  set(target, key, value) {
    // Allow the DB E2E spec to restore DATABASE_URL from the Testcontainers
    // sentinel set by jest.global-setup.js. This is the single legitimate
    // write path for DATABASE_URL during a test run.
    if (
      String(key) === 'DATABASE_URL' &&
      value &&
      value === target.LIFTING_TC_DATABASE_URL
    ) {
      target[key] = value;
      return true;
    }
    if (BLOCK.includes(String(key))) {
      return true; // discard — blocked keys are frozen at ''
    }
    target[key] = value;
    return true;
  },
});
