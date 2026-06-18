import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingFlow } from './OnboardingFlow';
import { PROGRAMS } from '@/lib/programs';
import { createFirstCycle } from './actions';

jest.mock('./actions', () => ({
  createFirstCycle: jest.fn(async () => undefined),
}));

const mockCreateFirstCycle = createFirstCycle as jest.MockedFunction<
  typeof createFirstCycle
>;

const CATALOG = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press'];

describe('OnboardingFlow — persistence of confirmed maxes', () => {
  beforeEach(() => {
    mockCreateFirstCycle.mockClear();
  });

  it('passes the computed maxes to createFirstCycle on completion (discard gap closed)', async () => {
    const user = userEvent.setup();
    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) throw new Error('Test setup: expected RPT program in PROGRAMS');

    render(<OnboardingFlow catalog={CATALOG} />);

    // Step 0 → Step 1 (Enter Lifts)
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Fill each default row: 200 × 5 → Brzycki 1RM = 225 → TM 90% = 203
    for (const lift of ['Bench Press', 'Squat', 'Deadlift']) {
      await user.type(screen.getByLabelText(`${lift} weight`), '200');
      await user.type(screen.getByLabelText(`${lift} reps`), '5');
    }

    // Step 1 → Step 2 (Confirm) → Step 3 (Programs)
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /continue to programs/i }));

    // The program list is experience-filtered; RPT is intermediate, so switch
    // to that tab before the card is visible.
    await user.click(screen.getByRole('tab', { name: new RegExp(rpt.experience, 'i') }));

    // Choose the RPT program (the available one) and confirm
    await user.click(screen.getByText(rpt.name));
    await user.click(screen.getByRole('button', { name: /choose this program/i }));

    // The flow now resolves each row to its final training max before calling the
    // action: 225 (1RM) × 90% = 203.
    expect(mockCreateFirstCycle).toHaveBeenCalledTimes(1);
    expect(mockCreateFirstCycle).toHaveBeenCalledWith(rpt.id, [
      { lift: 'Bench Press', trainingMax: 203 },
      { lift: 'Squat', trainingMax: 203 },
      { lift: 'Deadlift', trainingMax: 203 },
    ]);
  });

  it('persists entered training maxes as-is when the "tm" method is used (no 90% derivation)', async () => {
    const user = userEvent.setup();
    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) throw new Error('Test setup: expected RPT program in PROGRAMS');

    render(<OnboardingFlow catalog={CATALOG} />);

    // Step 0: pick the "Enter training maxes" method, then advance.
    await user.click(screen.getByRole('button', { name: /enter training maxes/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Weight-only rows (no reps input) — enter the training max directly.
    for (const lift of ['Bench Press', 'Squat', 'Deadlift']) {
      expect(screen.queryByLabelText(`${lift} reps`)).not.toBeInTheDocument();
      await user.type(screen.getByLabelText(`${lift} weight`), '315');
    }

    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /continue to programs/i }));
    await user.click(screen.getByRole('tab', { name: new RegExp(rpt.experience, 'i') }));
    await user.click(screen.getByText(rpt.name));
    await user.click(screen.getByRole('button', { name: /choose this program/i }));

    // 315 entered → 315 persisted (not 283).
    expect(mockCreateFirstCycle).toHaveBeenCalledTimes(1);
    expect(mockCreateFirstCycle).toHaveBeenCalledWith(rpt.id, [
      { lift: 'Bench Press', trainingMax: 315 },
      { lift: 'Squat', trainingMax: 315 },
      { lift: 'Deadlift', trainingMax: 315 },
    ]);
  });

  it('persists imported training maxes as-is when the "import" method is used (no 90% derivation)', async () => {
    const user = userEvent.setup();
    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) throw new Error('Test setup: expected RPT program in PROGRAMS');

    render(<OnboardingFlow catalog={CATALOG} />);

    // Step 0: pick "Import from a file", then advance to the import step.
    await user.click(screen.getByRole('button', { name: /import from a file/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Upload a training-maxes CSV — Squat has history, so the latest (315) wins.
    const csv = [
      'Date Updated,Lift,Weight',
      '2026-01-01,Squat,300',
      '2026-02-01,Squat,315',
      '2026-01-01,Bench Press,225',
    ].join('\n');
    await user.upload(
      screen.getByLabelText(/training-maxes csv/i),
      new File([csv], 'maxes.csv', { type: 'text/csv' }),
    );
    await waitFor(() =>
      expect(screen.getByText(/loaded 2 training maxes/i)).toBeInTheDocument(),
    );

    // Step 1 → Step 2 (Confirm) → Step 3 (Programs)
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /continue to programs/i }));
    await user.click(screen.getByRole('tab', { name: new RegExp(rpt.experience, 'i') }));
    await user.click(screen.getByText(rpt.name));
    await user.click(screen.getByRole('button', { name: /choose this program/i }));

    // Imported TMs persist verbatim (latest per lift), no 90% derivation.
    expect(mockCreateFirstCycle).toHaveBeenCalledTimes(1);
    expect(mockCreateFirstCycle).toHaveBeenCalledWith(rpt.id, [
      { lift: 'Squat', trainingMax: 315 },
      { lift: 'Bench Press', trainingMax: 225 },
    ]);
  });
});
