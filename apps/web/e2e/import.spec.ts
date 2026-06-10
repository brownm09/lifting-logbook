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

  // Preview step: create/update/skip counts and the commit action.
  await expect(page.getByRole('heading', { name: 'Preview changes' })).toBeVisible();
  await expect(page.getByText('Create', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Commit import' }).click();

  // Done step.
  await expect(page.getByText('Import complete')).toBeVisible();
});
