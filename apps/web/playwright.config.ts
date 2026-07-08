import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // staging.spec.ts is only for playwright.config.staging.ts (live Cloud Run environment).
  // Excluding it here prevents accidental runs against the local dev server, which lacks a
  // real Clerk session (window.Clerk.session is null) and would produce false failures.
  // Playwright's default testMatch also grabs `*.test.ts`; those are Jest unit tests
  // (e.g. e2e/mock-api.test.ts, which uses `describe`) and must not run under Playwright.
  testIgnore: ['**/staging.spec.ts', '**/*.test.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    // 127.0.0.1 (not localhost): the webServers below bind IPv4-only (0.0.0.0) on
    // Windows, while Node's verbatim DNS resolves localhost -> ::1 first, which those
    // servers refuse (ECONNREFUSED ::1). 127.0.0.1 is unambiguous IPv4 on every
    // platform and matches the bind; Linux CI is unaffected. See CLAUDE.md
    // "apps/web Playwright E2E (local)" and issue #741.
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-api.mjs',
      // Wait on an explicit 127.0.0.1 URL, not a bare port: the mock binds 127.0.0.1 and the
      // readiness probe must dial the same address the tests use, so a localhost->::1 default
      // can't leave the probe hanging (or pass against a stale ::1 server). See issue #741.
      url: 'http://127.0.0.1:3004/__reset',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Turbopack (Next.js 16) does not produce .next/standalone, and
      // next start with output:standalone breaks router.refresh(). Use
      // the dev server for E2E in all environments — it supports full
      // App Router cache invalidation and starts quickly with Turbopack.
      // --hostname 127.0.0.1 forces next dev to bind IPv4 loopback (its default host can
      // resolve to ::1-only on Windows); the explicit url readiness probe dials the same
      // 127.0.0.1 the browser baseURL uses, keeping them in agreement. See issue #741.
      command: 'npm run dev -- --hostname 127.0.0.1',
      url: 'http://127.0.0.1:3000',
      env: {
        // Runtime public config (#396 / ADR-028): no NEXT_PUBLIC_ prefix — the root layout
        // reads these at request time and injects them into window.__PUBLIC_CONFIG__.
        // 127.0.0.1 (not localhost) — see the note on `use.baseURL` above (issue #741).
        API_URL: 'http://127.0.0.1:3004',
        PUBLIC_API_URL: 'http://127.0.0.1:3004',
        DEFAULT_PROGRAM: '5-3-1',
        DEV_AUTH_TOKEN: 'e2e-test',
        // @clerk/testing@2 upgraded @clerk/clerk-react to a version that throws
        // throwMissingSecretKeyError during startup when CLERK_SECRET_KEY is absent.
        // A non-empty placeholder suppresses the throw; the middleware bypasses Clerk
        // entirely when DEV_AUTH_TOKEN is set, so this key is never used for auth.
        // CLERK_PUBLISHABLE_KEY (no prefix) is passed to <ClerkProvider> as a runtime prop.
        CLERK_PUBLISHABLE_KEY: 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk',
        CLERK_SECRET_KEY: 'sk_test_e2e_placeholder',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
