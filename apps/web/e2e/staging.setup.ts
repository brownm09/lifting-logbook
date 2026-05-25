import { chromium, expect } from '@playwright/test';
import { createClerkClient } from '@clerk/backend';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = path.join(__dirname, '../playwright/.auth/user.json');

async function globalSetup() {
  // Fetches a Clerk testing token from the Backend API using CLERK_SECRET_KEY.
  // Required before setupClerkTestingToken can bypass bot-detection in individual tests.
  await clerkSetup();

  const stagingUrl = process.env.STAGING_WEB_URL;
  const email = process.env.STAGING_CLERK_TEST_EMAIL;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!stagingUrl || !email || !secretKey) {
    throw new Error(
      'STAGING_WEB_URL, STAGING_CLERK_TEST_EMAIL, and CLERK_SECRET_KEY must be set',
    );
  }

  // Use the Clerk Backend SDK to create a sign-in token for the test user.
  // Sign-in tokens bypass all auth factors including MFA — the UI email/password
  // flow cannot complete when the account has factor-two (TOTP/SMS) enabled.
  const clerkBackend = createClerkClient({ secretKey });

  const { data: users } = await clerkBackend.users.getUserList({
    emailAddress: [email],
  });
  if (!users.length) {
    throw new Error(
      `Test user ${email} not found in Clerk. Create the account in the staging Clerk dashboard first.`,
    );
  }
  const { token } = await clerkBackend.signInTokens.createSignInToken({
    userId: users[0].id,
    expiresInSeconds: 60,
  });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Inject Clerk testing token to bypass bot-detection in this browser context.
  await setupClerkTestingToken({ page });

  // Navigate to /sign-in to load Clerk's JS SDK into the page context.
  await page.goto(`${stagingUrl}/sign-in`);

  // Wait for Clerk to finish initializing before calling client-side SDK methods.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.waitForFunction(() => !!(window as any).Clerk?.loaded);

  // Sign in using the ticket strategy — no UI interaction, no factor-two required.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(async (ticket: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (window as any).Clerk;
    const result = await cl.client.signIn.create({ strategy: 'ticket', ticket });
    await cl.setActive({ session: result.createdSessionId });
  }, token);

  // Navigate to the home page to confirm the session cookie is persisted and
  // the user is no longer redirected to sign-in.
  await page.goto(`${stagingUrl}/`);
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}

export default globalSetup;
