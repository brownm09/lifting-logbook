import { test, expect } from '@playwright/test';

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
  // Navigate first so the storageState cookies are active in the browser context.
  await page.goto('/');

  // Use page.evaluate() to call /api/health via browser-native fetch, which
  // guarantees the browser's own cookie jar (including Clerk session cookies) is
  // used.  page.request.get() goes through a separate network stack and may not
  // forward all cookies that Clerk's middleware depends on.
  //
  // /api/health is a Next.js route handler that calls auth().getToken() server-side
  // and then hits the backend API — verifying the full auth path without relying
  // on the client-side Clerk SDK (which has a 60-second JWT cache in dev mode).
  //
  // Status codes from the route handler:
  //   200 — full stack OK
  //   401 — no Clerk session (middleware blocked the request before reaching the handler)
  //   403 — Clerk session present but getToken() returned null
  //   503 — Clerk token obtained but backend API call failed
  const { status, body } = await page.evaluate(async () => {
    const r = await fetch('/api/health');
    const text = await r.text();
    return { status: r.status, body: text };
  });

  expect(
    status,
    `Expected 200 from /api/health — got ${status}. Body: ${body}. ` +
      '401=no session, 403=getToken() null (dev-mode TTL?), 503=backend API error. ' +
      'Check that the staging API is deployed and Clerk is configured correctly.',
  ).toBe(200);
});
