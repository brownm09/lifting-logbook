import { defineConfig, devices } from '@playwright/test';
import { clerkSetup } from '@clerk/testing/playwright';

if (!process.env.STAGING_WEB_URL) {
  throw new Error('STAGING_WEB_URL must be set to run staging integration tests');
}

export default clerkSetup(
  defineConfig({
    testDir: './e2e',
    testMatch: ['staging.spec.ts'],
    globalSetup: './e2e/staging.setup.ts',
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
  }),
);
