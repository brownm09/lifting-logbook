import { test, expect } from '@playwright/test';

// 127.0.0.1 (not localhost): IPv4-only dev servers + Windows localhost -> ::1 (#741, CLAUDE.md).
const MOCK_API = 'http://127.0.0.1:3004';

// The heavy /import route compiles on-demand in Next dev. On Windows local dev the first,
// cold compile of ImportWizard can exceed Playwright's 30s default test timeout, so the
// first navigating test would otherwise fail at page.goto before any assertion runs. Warm
// the route once here (with generous headroom) so every test navigates to an already-
// compiled /import. CI (Linux) compiles fast enough that this is effectively a no-op.
// See https://github.com/brownm09/lifting-logbook/issues/698.
test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
  await page.goto('/import', { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Import a file' })).toBeVisible({ timeout: 90_000 });
  await page.close();
});

// The Source step's program-picker lists custom programs; opt the mock into one.
test.beforeEach(async ({ request }) => {
  await request.get(`${MOCK_API}/__reset?withCustomProgram=true`);
});

test('import wizard: Source → Classify → Review → Preview → Done', async ({ page }) => {
  await page.goto('/import');

  // Source step: pick a program (pre-selected) and upload a CSV.
  await expect(page.getByRole('heading', { name: 'Import a file' })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('CSV file').setInputFiles({
    name: 'training_maxes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date Updated,Lift,Weight\n1/1/2026,Squat,300\n1/1/2026,Bench,210'),
  });
  await page.getByRole('button', { name: 'Analyze' }).click();

  // Classify step: detected destination + reasons.
  await expect(page.getByText('Training Maxes')).toBeVisible();
  await expect(page.getByText(/Why this classification/i)).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Map columns
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Review
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Preview

  // Preview step: count pills summarising creates/updates/skips + commit action.
  await expect(page.getByRole('heading', { name: 'Preview changes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit import' })).toBeEnabled();

  await page.getByRole('button', { name: 'Commit import' }).click();

  // Done step: success banner + undo affordance (batchId is set by the mock).
  await expect(page.getByText('Import complete')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo this import' })).toBeVisible();
});

test('import wizard REVIEW: remove a TM row then commit', async ({ page }) => {
  await page.goto('/import');

  await page.getByLabel('CSV file').setInputFiles({
    name: 'training_maxes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date Updated,Lift,Weight\n1/1/2026,Squat,300\n1/1/2026,Bench,210'),
  });
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('Training Maxes')).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Map columns
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Review

  // Review step: editable training-max list with two rows.
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove squat' })).toBeVisible();

  // Remove the squat row — it disappears from the editable list.
  await page.getByRole('button', { name: 'Remove squat' }).click();
  await expect(page.getByRole('button', { name: 'Remove squat' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Preview
  await expect(page.getByRole('heading', { name: 'Preview changes' })).toBeVisible();

  await page.getByRole('button', { name: 'Commit import' }).click();
  await expect(page.getByText('Import complete')).toBeVisible();
});

test('import wizard DONE: undo import restores rows', async ({ page }) => {
  await page.goto('/import');

  await page.getByLabel('CSV file').setInputFiles({
    name: 'training_maxes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date Updated,Lift,Weight\n1/1/2026,Squat,300\n1/1/2026,Bench,210'),
  });
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('Training Maxes')).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Map columns
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Review
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // → Preview
  await page.getByRole('button', { name: 'Commit import' }).click();

  // Done step: undo button is visible (mock provides batchId).
  await expect(page.getByText('Import complete')).toBeVisible();
  const undoBtn = page.getByRole('button', { name: 'Undo this import' });
  await expect(undoBtn).toBeVisible();

  await undoBtn.click();

  // After undo: result replaces the button.
  await expect(page.getByText(/Undo complete/)).toBeVisible();
  await expect(page.getByText(/2 restored/)).toBeVisible();
});

test('import wizard MAP_COLUMNS: fuzzy-matched columns shown; override unmapped column enables Next', async ({ page, request }) => {
  // Override the default reset to enable the non-standard-columns scenario.
  await request.get(`${MOCK_API}/__reset?withCustomProgram=true&withNonStandardColumns=true`);

  await page.goto('/import');

  // Source step: upload a CSV with non-standard headers (Date, Exercise, Max Weight).
  await expect(page.getByRole('heading', { name: 'Import a file' })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('CSV file').setInputFiles({
    name: 'nonstandard.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date,Exercise,Max Weight\n1/1/2026,Squat,300'),
  });
  await page.getByRole('button', { name: 'Analyze' }).click();

  // Classify step: mock classifies as Training Maxes.
  await expect(page.getByText('Training Maxes')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // MAP_COLUMNS step: mapping table is shown with the fuzzy-matched source columns.
  await expect(page.getByRole('heading', { name: 'Map columns' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Column mappings' })).toBeVisible();

  // "Exercise" is unmapped (required, confidence 0) — alert visible, Next disabled.
  await expect(page.getByText('Some required fields are not yet mapped')).toBeVisible();
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  await expect(nextButton).toBeDisabled();

  // Override the Exercise column → Lift.
  await page.getByLabel('Map column Exercise').selectOption({ label: 'Lift' });

  // Alert should disappear and Next should become enabled.
  await expect(page.getByText('Some required fields are not yet mapped')).not.toBeVisible();
  await expect(nextButton).toBeEnabled();

  // Clicking Next advances to the Review step.
  await nextButton.click();
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
});
