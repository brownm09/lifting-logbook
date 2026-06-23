import { test, expect } from '@playwright/test';

const MOCK_API = 'http://localhost:3004';

test.beforeEach(async ({ request }) => {
  await request.get(`${MOCK_API}/__reset`);
});

// ---------------------------------------------------------------------------
// Skip / Unskip workout
// ---------------------------------------------------------------------------

test('skip a workout from detail page — Skipped badge shown', async ({ page }) => {
  await page.goto('/cycle/1/workout/1/detail');

  // SkipForm trigger is visible for an upcoming (non-completed) workout
  const skipBtn = page.getByRole('button', { name: '⊘ Mark as Skipped' });
  await expect(skipBtn).toBeVisible();
  await skipBtn.click();

  // Expanded form appears with confirm button
  const confirmBtn = page.getByRole('button', { name: 'Skip Workout' });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  // After refresh, page shows Skipped badge
  await expect(page.getByText('⊘ Skipped')).toBeVisible();
  // Start Logging link hidden for skipped workouts
  await expect(page.getByRole('link', { name: 'Start Logging' })).not.toBeVisible();
  // Undo button is now shown
  await expect(page.getByRole('button', { name: '↩ Undo Skip' })).toBeVisible();
});

test('skip a workout — cycle dashboard card shows Skipped status', async ({ page, request }) => {
  // Pre-skip workout 1 via API so the dashboard reflects it
  await request.post(`${MOCK_API}/programs/5-3-1/cycles/1/workouts/1/skip`);

  await page.goto('/cycle/1');
  await expect(page).toHaveURL(/\/cycle\/1/);

  // The workout card for workout 1 should show the Skipped badge
  await expect(page.locator('text=Skipped').first()).toBeVisible();
});

test('undo skip — workout reverts to Upcoming/Missed status', async ({ page, request }) => {
  // Pre-skip workout 1
  await request.post(`${MOCK_API}/programs/5-3-1/cycles/1/workouts/1/skip`);

  await page.goto('/cycle/1/workout/1/detail');

  // Undo button visible for a skipped workout
  const undoBtn = page.getByRole('button', { name: '↩ Undo Skip' });
  await expect(undoBtn).toBeVisible();
  await undoBtn.click();

  // Confirm undo
  const confirmBtn = page.getByRole('button', { name: 'Undo Skip' });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  // After refresh, ⊘ Skipped is gone; Skip button is back
  await expect(page.getByText('⊘ Skipped')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '⊘ Mark as Skipped' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Schedule-mode confirmation prompt
// ---------------------------------------------------------------------------

test('selecting a program with schedule set shows schedule-info step', async ({ page, request }) => {
  // Reset with a Mon/Wed/Fri schedule so the settings endpoint returns it
  await request.get(`${MOCK_API}/__reset?withSchedule=true`);

  await page.goto('/programs');

  // Open the switch dialog (multiple programs available; pick the first)
  await page.getByRole('button', { name: 'Choose This Program' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Confirm switch
  await page.getByRole('button', { name: 'Confirm Switch' }).click();

  // Schedule-info step should appear
  await expect(page.getByText(/Workout dates have been distributed/i)).toBeVisible();
  await expect(page.getByText(/Mon \/ Wed \/ Fri/i)).toBeVisible();
  await expect(page.getByText(/3 workouts\/week/i)).toBeVisible();

  // Navigates to cycle when "Go to Cycle" is clicked
  await page.getByRole('button', { name: 'Go to Cycle' }).click();
  await expect(page).toHaveURL(/\/cycle\/1/);
});

test('selecting a program without schedule skips the schedule-info step', async ({ page }) => {
  // Default reset has workoutSchedule: null
  await page.goto('/programs');

  await page.getByRole('button', { name: 'Choose This Program' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: 'Confirm Switch' }).click();

  // Should navigate directly to cycle — no schedule-info step
  await expect(page).toHaveURL(/\/cycle\/1/, { timeout: 10_000 });
});
