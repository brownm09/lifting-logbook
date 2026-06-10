import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CustomProgramSummaryResponse, ImportPreviewResponse } from '@lifting-logbook/types';
import { ImportWizard } from './ImportWizard';
import { commitImport, previewImport } from '@/lib/client-api';

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

    // Preview step shows the create/update/skip counts.
    expect(screen.getByText('Preview changes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Commit import' }));

    await waitFor(() => expect(screen.getByText('Import complete')).toBeInTheDocument());
    expect(mockCommit).toHaveBeenCalledWith('prog-1', file, 'training-maxes');
  });

  it('shows a manual destination picker when classification is low-confidence', async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      classification: { type: null, confidence: 0.4, bucket: 'low', reasons: [], alternatives: [] },
      destination: null,
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
