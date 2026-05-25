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
