import { test, expect } from '@playwright/test';

const MOCK_API = 'http://localhost:3004';

// The Source step's program-picker lists custom programs; opt the mock into one.
test.beforeEach(async ({ request }) => {
  await request.get(`${MOCK_API}/__reset?withCustomProgram=true`);
});

test('import wizard: Source → Classify → Preview → Done', async ({ page }) => {
  await page.goto('/import');

  // Source step: pick a program (pre-selected) and upload a CSV.
  await expect(page.getByRole('heading', { name: 'Import a file' })).toBeVisible();
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

  // Preview step: live summary (training-maxes editable list) and the commit action.
  await expect(page.getByRole('heading', { name: 'Preview changes' })).toBeVisible();
  await expect(page.getByText('2 maxes will be imported.')).toBeVisible();

  await page.getByRole('button', { name: 'Commit import' }).click();

  // Done step.
  await expect(page.getByText('Import complete')).toBeVisible();
});

test('import wizard MAP_COLUMNS: fuzzy-matched columns shown; override unmapped column enables Next', async ({ page, request }) => {
  // Override the default reset to enable the non-standard-columns scenario.
  await request.get(`${MOCK_API}/__reset?withCustomProgram=true&withNonStandardColumns=true`);

  await page.goto('/import');

  // Source step: upload a CSV with non-standard headers (Date, Exercise, Max Weight).
  await expect(page.getByRole('heading', { name: 'Import a file' })).toBeVisible();
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
