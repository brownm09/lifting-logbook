import { render, screen } from '@testing-library/react';
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

    // Fill each default row: 200 × 5 → Brzycki 1RM = 225
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

    expect(mockCreateFirstCycle).toHaveBeenCalledTimes(1);
    expect(mockCreateFirstCycle).toHaveBeenCalledWith(rpt.id, [
      { lift: 'Bench Press', oneRm: 225 },
      { lift: 'Squat', oneRm: 225 },
      { lift: 'Deadlift', oneRm: 225 },
    ]);
  });
});
