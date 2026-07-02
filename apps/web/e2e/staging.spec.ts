import { test, expect } from '@playwright/test';

// Staging integration tests — run against the live Cloud Run staging environment.
// Auth state is provided by staging.setup.ts (signs in once, saves session).
//
// Constraints:
// - No mock API, no __reset endpoint
// - Assertions check structure/presence only — not hardcoded seed data values
// - Write-path tests must be idempotent or self-cleaning

// ---------------------------------------------------------------------------
// 1. Home page redirects signed-in users to the authenticated landing page
//
// Per #384, `/` is now an async server component that calls `auth()` and
// redirects signed-in users to `/cycle`. The marketing card is reserved for
// signed-out visitors and is exercised by Jest in apps/web/app/page.test.tsx
// (renderToStaticMarkup assertions). The staging suite runs with a saved
// Clerk session, so the only observable behavior here is the redirect itself.
// `/cycle` further redirects to `/onboarding` when the test user has no
// active cycle, so accept either landing URL.
// ---------------------------------------------------------------------------

test('home page redirects signed-in users to /cycle (or /onboarding)', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(cycle(\/\d+)?|onboarding)$/, { timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// 2. Programs catalog loads
//
// Structure-only assertion is intentional: the program catalog is rendered
// from static data in apps/web/lib/programs.ts, so the page renders even
// when the `.catch(() => DEFAULT_SETTINGS)` and `.catch(() => [])` fallbacks
// in apps/web/app/(authed)/programs/page.tsx:14-15 are exercised. The staging test
// user has no custom programs, so no real-data assertion would distinguish
// the success and fallback paths here. API-success detection is delegated
// to test 5 (auth/API propagation against /api/health).
// ---------------------------------------------------------------------------

test('programs page catalog loads', async ({ page }) => {
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: 'Programs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose This Program' }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. History page tabs render
//
// Structure-only assertion is intentional: the staging test user has no
// records, so neither real data nor the fallback `[]` from
// apps/web/app/(authed)/history/page.tsx:37-38 produces visible content. The API
// success path for history fetches is covered indirectly by test 5
// (auth/API propagation against /api/health).
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
//
// The URL-or-onboarding tolerance is intentional: the staging test user
// has no active cycle, so the try/catch in apps/web/app/(authed)/cycle/page.tsx:10-16
// redirects to /onboarding on both "no cycle" and "API failed". This test
// cannot distinguish the two; API-failure detection is delegated to test 5
// which calls /api/health and asserts a specific HTTP 200.
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
  //   200 — Clerk session valid; API /health returned 200 (or no GCP metadata, auth-only)
  //   401 — no Clerk session (auth().userId is null — storageState not recognised)
  //   503 — Clerk session valid but GET ${API_URL}/health failed (IAM, network, or API down)
  const { status, body } = await page.evaluate(async () => {
    const r = await fetch('/api/health');
    const text = await r.text();
    return { status: r.status, body: text };
  });

  expect(
    status,
    `Expected 200 from /api/health — got ${status}. Body: ${body}. ` +
      '401=Clerk session not recognised server-side (storageState may be stale). ' +
      '503=Clerk valid but API call failed — check API_URL, IAM (web_invoker_on_api), or Cloud Run logs. ' +
      'Check that the staging API is deployed and Clerk is configured correctly.',
  ).toBe(200);
});
