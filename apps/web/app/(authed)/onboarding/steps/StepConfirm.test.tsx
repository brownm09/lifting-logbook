import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { StepConfirm } from './StepConfirm';

describe('StepConfirm — 1RM-derived methods', () => {
  it('shows the 1RM with the derived training max alongside it', () => {
    render(
      <StepConfirm
        method="estimate"
        maxes={[{ lift: 'Squat', oneRm: 225, trainingMax: 203 }]}
      />,
    );
    expect(screen.getByText('Squat')).toBeInTheDocument();
    // Both the 1RM and the derived TM are shown.
    expect(screen.getByText(/225 lb/)).toBeInTheDocument();
    expect(screen.getByText(/TM 203 lb/)).toBeInTheDocument();
    expect(screen.getByText(/90% of the 1RM/i)).toBeInTheDocument();
  });
});

describe('StepConfirm — training-max method', () => {
  it('shows the entered training max as-is with no 1RM or 90% note', () => {
    render(
      <StepConfirm
        method="tm"
        maxes={[{ lift: 'Squat', oneRm: null, trainingMax: 315 }]}
      />,
    );
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText(/TM 315 lb/)).toBeInTheDocument();
    // No 1RM value and no 90% derivation copy for a direct training max.
    expect(screen.queryByText(/90% of the 1RM/i)).not.toBeInTheDocument();
    expect(screen.getByText(/as entered/i)).toBeInTheDocument();
  });
});
