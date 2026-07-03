import { defineConfig, devices } from '@playwright/test';

// clerkSetup is called inside staging.setup.ts (the globalSetup), not here.
// The @clerk/testing v2 clerkSetup signature is (options?: ClerkSetupOptions) — it does
// not accept a PlaywrightTestConfig. STAGING_WEB_URL validation is deferred to runtime
// (staging.setup.ts) so the Next.js build does not throw when the var is unset.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['staging.spec.ts'],
  globalSetup: './e2e/staging.setup.ts',
  // fullyParallel: false + testMatch restricted to this one file is what keeps
  // staging.spec.ts's tests running strictly in declaration order in a single
  // worker, regardless of the `workers` count below. This matters because test
  // 6 (the onboarding write-path test, issue #647) mutates the shared staging
  // test account and must run last, after every read-only test — setting
  // fullyParallel: true, or adding a second file to testMatch, would need test
  // 6's placement reconsidered.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  use: {
    baseURL: process.env.STAGING_WEB_URL,
    storageState: 'playwright/.auth/user.json',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer — tests run against the live staging Cloud Run service
});
