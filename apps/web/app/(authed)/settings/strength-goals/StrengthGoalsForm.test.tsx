import { render, screen } from '@testing-library/react';
import type { StrengthGoalResponse, TrainingMaxResponse } from '@lifting-logbook/types';
import StrengthGoalsForm from './StrengthGoalsForm';

jest.mock('./actions', () => ({
  saveStrengthGoal: jest.fn(),
  removeStrengthGoal: jest.fn(),
  saveBodyWeight: jest.fn(),
}));

const SQUAT_TM: TrainingMaxResponse = {
  lift: 'Back Squat',
  weight: 100,
  unit: 'lbs',
  dateUpdated: '2026-06-01',
};

describe('StrengthGoalsForm — cross-unit progress', () => {
  // 45.359237 kg is the exact conversion of 100 lbs, so a correctly unit-aware
  // comparison lands at exactly 100%. Before the cross-unit fix, the training max
  // (100, implicitly lbs) was compared directly against the body weight/target
  // number without converting units first, which would have shown ~220% here
  // instead — this test pins the correct behavior and would catch a regression.
  it('converts the training max into the body-weight unit for a relative goal', () => {
    const goals: StrengthGoalResponse[] = [
      { lift: 'Back Squat', goalType: 'relative', ratio: 1, unit: 'kg', updatedAt: '2026-06-01' },
    ];
    render(
      <StrengthGoalsForm
        program="5-3-1"
        trainingMaxes={[SQUAT_TM]}
        goals={goals}
        bodyWeight={{ date: '2026-06-01', weight: 45.359237, unit: 'kg' }}
        preferredUnit="kg"
      />,
    );

    expect(screen.getByText(/100% of goal/)).toBeInTheDocument();
  });

  it('converts the training max into the target unit for an absolute goal', () => {
    const goals: StrengthGoalResponse[] = [
      { lift: 'Back Squat', goalType: 'absolute', target: 45.359237, unit: 'kg', updatedAt: '2026-06-01' },
    ];
    render(
      <StrengthGoalsForm
        program="5-3-1"
        trainingMaxes={[SQUAT_TM]}
        goals={goals}
        bodyWeight={{ date: '2026-06-01', weight: 70, unit: 'kg' }}
        preferredUnit="kg"
      />,
    );

    expect(screen.getByText(/100% of goal/)).toBeInTheDocument();
  });

  it('shows the current training max converted to the preferred unit', () => {
    render(
      <StrengthGoalsForm
        program="5-3-1"
        trainingMaxes={[SQUAT_TM]}
        goals={[]}
        bodyWeight={null}
        preferredUnit="kg"
      />,
    );

    // 100 lbs -> 45.36 kg.
    expect(screen.getByText(/Current max: 45\.36 kg/)).toBeInTheDocument();
  });

  it('defaults a new goal row to the preferred unit', () => {
    render(
      <StrengthGoalsForm
        program="5-3-1"
        trainingMaxes={[SQUAT_TM]}
        goals={[]}
        bodyWeight={null}
        preferredUnit="kg"
      />,
    );

    // New rows default to the 'relative' goal type, whose unit select shares
    // the same aria-label as the 'absolute' branch's.
    expect(screen.getByLabelText('Unit for Back Squat')).toHaveValue('kg');
  });
});
