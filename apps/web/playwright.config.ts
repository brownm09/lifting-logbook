import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
        API_URL: 'http://localhost:3004',
        NEXT_PUBLIC_API_URL: 'http://localhost:3004',
        DEV_AUTH_TOKEN: 'e2e-test',
        NEXT_PUBLIC_DEV_AUTH_TOKEN: 'e2e-test',
        // @clerk/testing@2 upgraded @clerk/clerk-react to a version that throws
        // throwMissingSecretKeyError during startup when CLERK_SECRET_KEY is absent.
        // A non-empty placeholder suppresses the throw; the middleware bypasses Clerk
        // entirely when DEV_AUTH_TOKEN is set, so this key is never used for auth.
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk',
        CLERK_SECRET_KEY: 'sk_test_e2e_placeholder',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
