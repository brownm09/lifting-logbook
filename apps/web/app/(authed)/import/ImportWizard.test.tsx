import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CustomProgramSummaryResponse, ImportPreviewResponse } from '@lifting-logbook/types';
import { ImportWizard } from './ImportWizard';
import { commitImport, previewImport } from '@/lib/client-api';

// File.text() is not implemented in jsdom; use FileReader instead.
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

jest.mock('@/lib/client-api', () => ({
  previewImport: jest.fn(),
  commitImport: jest.fn(),
}));

const mockPreview = previewImport as jest.MockedFunction<typeof previewImport>;
const mockCommit = commitImport as jest.MockedFunction<typeof commitImport>;

const PROGRAMS: CustomProgramSummaryResponse[] = [
  { id: 'prog-1', name: 'My Program', description: null, baseTemplate: null, createdAt: '2026-01-01' },
];

const TM_PREVIEW: ImportPreviewResponse = {
  classification: {
    type: 'training-maxes',
    confidence: 0.95,
    bucket: 'high',
    reasons: ['Matched 4/4 expected columns'],
    alternatives: [{ type: 'lift-records', confidence: 0.4, closeCall: false }],
  },
  destination: 'training-maxes',
  columnMappings: [
    { sourceHeader: 'Date Updated', destinationField: 'dateUpdated', confidence: 1.0, required: true },
    { sourceHeader: 'Lift', destinationField: 'lift', confidence: 1.0, required: true },
    { sourceHeader: 'Weight', destinationField: 'weight', confidence: 1.0, required: true },
  ],
  preview: {
    creates: 2,
    updates: 1,
    skips: 0,
    deltas: [
      { key: 'squat', label: 'squat', kind: 'create', after: '300' },
      { key: 'bench', label: 'bench', kind: 'update', before: '200', after: '210' },
    ],
  },
  errors: [],
};

describe('ImportWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('walks Source → Classify → Preview → Done for a confident classification', async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue(TM_PREVIEW);
    mockCommit.mockResolvedValue({
      ok: true,
      data: { destination: 'training-maxes', created: 2, updated: 1, skipped: 0 },
    });

    render(<ImportWizard programs={PROGRAMS} />);

    const file = new File(['Date Updated,Lift,Weight\n1/1/2026,Squat,300'], 'tm.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText('CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    // Classify step renders the detected destination + a reason.
    await waitFor(() => expect(screen.getByText('Training Maxes')).toBeInTheDocument());
    expect(mockPreview).toHaveBeenCalledWith('prog-1', file, undefined);
    expect(screen.getByText('Matched 4/4 expected columns')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' })); // Classify → Map
    await user.click(screen.getByRole('button', { name: 'Next' })); // Map → Review
    await user.click(screen.getByRole('button', { name: 'Next' })); // Review → Preview

    // Preview step shows the live summary (not stale pills) and the editable list.
    expect(screen.getByText('Preview changes')).toBeInTheDocument();
    expect(screen.getByText('2 maxes will be imported.')).toBeInTheDocument();
    // Editable list is shown for training-maxes (from previewBody.deltas).
    expect(screen.getByLabelText('Weight for squat')).toBeInTheDocument();
    expect(screen.getByLabelText('Weight for bench')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Commit import' }));

    await waitFor(() => expect(screen.getByText('Import complete')).toBeInTheDocument());
    // Commit receives a rebuilt File (not the original), since the user may have
    // edited maxes; verify it is still a File for training-maxes destination.
    expect(mockCommit).toHaveBeenCalledWith('prog-1', expect.any(File), 'training-maxes');
  });

  it('training-maxes: edited weight is reflected in the commit payload', async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue(TM_PREVIEW);
    mockCommit.mockResolvedValue({
      ok: true,
      data: { destination: 'training-maxes', created: 2, updated: 1, skipped: 0 },
    });

    render(<ImportWizard programs={PROGRAMS} />);

    const file = new File(['Date Updated,Lift,Weight\n1/1/2026,Squat,300'], 'tm.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText('CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(screen.getByText('Training Maxes')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Next' })); // Classify → Map
    await user.click(screen.getByRole('button', { name: 'Next' })); // Map → Review
    await user.click(screen.getByRole('button', { name: 'Next' })); // Review → Preview

    // Edit the squat weight from '300' to '325'.
    const weightInput = screen.getByLabelText('Weight for squat');
    await user.clear(weightInput);
    await user.type(weightInput, '325');

    await user.click(screen.getByRole('button', { name: 'Commit import' }));
    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));

    const [, commitFile] = mockCommit.mock.calls[0] as [string, File, string];
    const text = await readFileText(commitFile);
    expect(text).toContain('squat');
    expect(text).toContain('325');
    expect(text).not.toContain(',300');
  });

  it('training-maxes: removed row is excluded from the commit payload', async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue(TM_PREVIEW);
    mockCommit.mockResolvedValue({
      ok: true,
      data: { destination: 'training-maxes', created: 1, updated: 0, skipped: 0 },
    });

    render(<ImportWizard programs={PROGRAMS} />);

    const file = new File(['Date Updated,Lift,Weight\n1/1/2026,Squat,300'], 'tm.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText('CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(screen.getByText('Training Maxes')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Next' })); // Classify → Map
    await user.click(screen.getByRole('button', { name: 'Next' })); // Map → Review
    await user.click(screen.getByRole('button', { name: 'Next' })); // Review → Preview

    // Remove the bench row — live count must decrement immediately.
    await user.click(screen.getByRole('button', { name: 'Remove bench' }));
    expect(screen.getByText('1 max will be imported.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Commit import' }));
    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));

    const [, commitFile] = mockCommit.mock.calls[0] as [string, File, string];
    const text = await readFileText(commitFile);
    expect(text).toContain('squat');
    expect(text).not.toContain('bench');
  });

  it('training-maxes: Back then Next preserves edits rather than resetting from preview', async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue(TM_PREVIEW);
    mockCommit.mockResolvedValue({
      ok: true,
      data: { destination: 'training-maxes', created: 2, updated: 1, skipped: 0 },
    });

    render(<ImportWizard programs={PROGRAMS} />);

    const file = new File(['Date Updated,Lift,Weight\n1/1/2026,Squat,300'], 'tm.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText('CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(screen.getByText('Training Maxes')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Next' })); // Classify → Map
    await user.click(screen.getByRole('button', { name: 'Next' })); // Map → Review
    await user.click(screen.getByRole('button', { name: 'Next' })); // Review → Preview (initializes editedMaxes)

    // Edit squat weight on step 5.
    const weightInput = screen.getByLabelText('Weight for squat');
    await user.clear(weightInput);
    await user.type(weightInput, '350');

    // Navigate back to step 4, then forward again — edits must survive.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // The weight should still be '350', not reset to the original '300'.
    expect(screen.getByLabelText('Weight for squat')).toHaveValue(350);
  });

  it('training-maxes: commit is disabled when a weight field is cleared', async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue(TM_PREVIEW);
    mockCommit.mockResolvedValue({
      ok: true,
      data: { destination: 'training-maxes', created: 2, updated: 1, skipped: 0 },
    });

    render(<ImportWizard programs={PROGRAMS} />);

    const file = new File(['Date Updated,Lift,Weight\n1/1/2026,Squat,300'], 'tm.csv', {
      type: 'text/csv',
    });
    await user.upload(screen.getByLabelText('CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(screen.getByText('Training Maxes')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Next' })); // Classify → Map
    await user.click(screen.getByRole('button', { name: 'Next' })); // Map → Review
    await user.click(screen.getByRole('button', { name: 'Next' })); // Review → Preview

    // Clear one weight field — commit must become disabled.
    const weightInput = screen.getByLabelText('Weight for squat');
    await user.clear(weightInput);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Commit import' })).toBeDisabled();
    });
  });

  it('shows a manual destination picker when classification is low-confidence', async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      classification: { type: null, confidence: 0.4, bucket: 'low', reasons: [], alternatives: [] },
      destination: null,
      columnMappings: null,
      preview: null,
      errors: [],
    });

    render(<ImportWizard programs={PROGRAMS} />);
    const file = new File(['Foo,Bar\n1,2'], 'mystery.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    await waitFor(() =>
      expect(screen.getByText(/couldn.t confidently tell/i)).toBeInTheDocument(),
    );
    // All four destinations are offered as manual picks.
    expect(screen.getByRole('button', { name: /Lift History/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Program/ })).toBeInTheDocument();
  });
});
