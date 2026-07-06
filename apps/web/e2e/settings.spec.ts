import { test, expect } from '@playwright/test';

const MOCK_API = 'http://localhost:3004';

test.beforeEach(async ({ request }) => {
  // The Import wizard's Source step lists custom programs; opt the mock into one
  // so the wizard renders its normal flow when reached via the hub link.
  await request.get(`${MOCK_API}/__reset?withCustomProgram=true`);
});

// ---------------------------------------------------------------------------
// Settings hub: the four section tabs are present and cross-navigate.
// ---------------------------------------------------------------------------

test('settings hub exposes the four sections and the sub-nav cross-navigates', async ({ page }) => {
  await page.goto('/settings');

  const subNav = page.getByRole('navigation', { name: 'Settings sections' });
  await expect(subNav.getByRole('link', { name: 'Training Maxes' })).toHaveAttribute(
    'href',
    '/settings/training-maxes',
  );
  await expect(subNav.getByRole('link', { name: 'Strength Goals' })).toHaveAttribute(
    'href',
    '/settings/strength-goals',
  );
  await expect(subNav.getByRole('link', { name: 'Schedule' })).toHaveAttribute(
    'href',
    '/settings/schedule',
  );
  await expect(subNav.getByRole('link', { name: 'Weight Rounding' })).toHaveAttribute(
    'href',
    '/settings/weight-rounding',
  );

  // The sub-nav actually moves between sections and marks the target active.
  await subNav.getByRole('link', { name: 'Weight Rounding' }).click();
  await expect(page).toHaveURL(/\/settings\/weight-rounding$/);
  await expect(
    page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Weight Rounding' }),
  ).toHaveAttribute('aria-current', 'page');
});

// ---------------------------------------------------------------------------
// Settings hub: the previously-orphaned /import wizard is reachable by link.
// ---------------------------------------------------------------------------

test('settings hub links to the Import wizard, which renders when reached', async ({ page }) => {
  await page.goto('/settings');

  await page.getByRole('link', { name: /Import data/i }).click();
  await expect(page).toHaveURL(/\/import$/);
  // A cold Next dev compile of the heavy import route can exceed the 5s default
  // on Windows; give the first render headroom (mirrors smoke.spec's 15s nav waits).
  await expect(page.getByRole('heading', { name: 'Import a file' })).toBeVisible({ timeout: 15_000 });
});
