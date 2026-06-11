import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // staging.spec.ts is only for playwright.config.staging.ts (live Cloud Run environment).
  // Excluding it here prevents accidental runs against the local dev server, which lacks a
  // real Clerk session (window.Clerk.session is null) and would produce false failures.
  testIgnore: ['**/staging.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
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
      port: 3004,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Turbopack (Next.js 16) does not produce .next/standalone, and
      // next start with output:standalone breaks router.refresh(). Use
      // the dev server for E2E in all environments — it supports full
      // App Router cache invalidation and starts quickly with Turbopack.
      command: 'npm run dev',
      port: 3000,
      env: {
        // Runtime public config (#396 / ADR-028): no NEXT_PUBLIC_ prefix — the root layout
        // reads these at request time and injects them into window.__PUBLIC_CONFIG__.
        API_URL: 'http://localhost:3004',
        PUBLIC_API_URL: 'http://localhost:3004',
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
