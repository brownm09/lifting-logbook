import { chromium, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = path.join(__dirname, '../playwright/.auth/user.json');

async function globalSetup() {
  const stagingUrl = process.env.STAGING_WEB_URL;
  const email = process.env.STAGING_CLERK_TEST_EMAIL;
  const password = process.env.STAGING_CLERK_TEST_PASSWORD;

  if (!stagingUrl || !email || !password) {
    throw new Error(
      'STAGING_WEB_URL, STAGING_CLERK_TEST_EMAIL, and STAGING_CLERK_TEST_PASSWORD must be set',
    );
  }

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // setupClerkTestingToken bypasses Clerk's bot-detection/CAPTCHA in CI
  await setupClerkTestingToken({ page });

  await page.goto(`${stagingUrl}/sign-in`);
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Wait until Clerk redirects away from the sign-in page
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}

export default globalSetup;
