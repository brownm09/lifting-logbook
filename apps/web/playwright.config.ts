import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
      command: 'npm run dev',
      port: 3000,
      env: {
        API_URL: 'http://localhost:3004',
        NEXT_PUBLIC_API_URL: 'http://localhost:3004',
        DEV_AUTH_TOKEN: 'e2e-test',
        NEXT_PUBLIC_DEV_AUTH_TOKEN: 'e2e-test',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
