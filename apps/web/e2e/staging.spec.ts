import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

// Staging integration tests — run against the live Cloud Run staging environment.
// Auth state is provided by staging.setup.ts (signs in once, saves session).
//
// Constraints:
// - No mock API, no __reset endpoint
// - Assertions check structure/presence only — not hardcoded seed data values
// - Write-path tests must be idempotent or self-cleaning

// ---------------------------------------------------------------------------
// 1. Home page renders
// ---------------------------------------------------------------------------

test('home page renders with primary navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lifting Logbook' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Current Cycle/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Get Started/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. Programs catalog loads
// ---------------------------------------------------------------------------

test('programs page catalog loads', async ({ page }) => {
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: 'Programs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose This Program' }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. History page tabs render
// ---------------------------------------------------------------------------

test('history page renders both tabs', async ({ page }) => {
  await page.goto('/history');
  await expect(page.getByRole('tab', { name: 'Lift History' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'TM Timeline' })).toBeVisible();
  await page.getByRole('tab', { name: 'TM Timeline' }).click();
  await expect(page.getByRole('tab', { name: 'TM Timeline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

// ---------------------------------------------------------------------------
// 4. Cycle dashboard renders (or onboarding if no cycle exists)
// ---------------------------------------------------------------------------

test('cycle resolves to dashboard or onboarding', async ({ page }) => {
  await page.goto('/cycle');
  await expect(page).toHaveURL(/\/(cycle\/\d+|onboarding)/, { timeout: 15_000 });
  if (page.url().includes('/onboarding')) {
    await expect(page.getByRole('heading', { name: 'Get Started' })).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// 5. Auth propagation — verifies the full auth stack works end-to-end
//
// Tests 1–4 assert page structure only. Because the server components swallow
// API errors (redirect or render empty), they pass even if the API is down.
// This test directly calls the API with the Clerk JWT to confirm:
//   (a) the session token written by global setup is still valid
//   (b) the API service is reachable from the test runner
//   (c) auth headers are accepted (not stripped, not expired)
// ---------------------------------------------------------------------------

test('authenticated API call succeeds (auth propagation)', async ({ page }) => {
  // The dev-browser JWT (__clerk_db_jwt) stored in storageState was created for
  // the global-setup browser context, which is closed before individual tests run.
  // Without re-injection, Clerk's FAPI dev-mode handshake fails and
  // window.Clerk.session is null even though the server-side session is valid.
  await setupClerkTestingToken({ page });

  await page.goto('/');

  // Wait for Clerk to finish its FAPI initialization before reading session state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.waitForFunction(() => !!(window as any).Clerk?.loaded);

  // Retrieve the current Clerk session token.  This is the same JWT that the
  // Next.js server attaches as Authorization: Bearer on every API call.
  const token = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (window as any).Clerk;
    if (!cl?.session) return null;
    return cl.session.getToken() as Promise<string | null>;
  });
  expect(token, 'Clerk session must be active — check global setup').toBeTruthy();

  const apiUrl = process.env.STAGING_API_URL;
  expect(apiUrl, 'STAGING_API_URL must be set in CI environment').toBeTruthy();

  // GET /users/me/settings returns 200 for any authenticated user regardless of
  // whether they have saved settings — it is a data-independent auth round-trip.
  const response = await page.request.get(`${apiUrl}/users/me/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(
    response.status(),
    `Expected 200 from API — got ${response.status()}. Check that the staging API is deployed and the Clerk secret key is configured.`,
  ).toBe(200);
});
