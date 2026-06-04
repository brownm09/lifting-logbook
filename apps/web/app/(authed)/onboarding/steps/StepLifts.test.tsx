import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { StepLifts } from './StepLifts';
import { DEFAULT_LIFTS, type DiscoveryMethod, type LiftRow } from '../lib';

const CATALOG = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
];

/** Wrapper wiring the same add/remove/update reducers OnboardingFlow uses, so
 *  picker interactions actually mutate the rendered row list. */
function Harness({ method = 'estimate' as DiscoveryMethod }: { method?: DiscoveryMethod }) {
  const [lifts, setLifts] = useState<LiftRow[]>(
    DEFAULT_LIFTS.map((lift) => ({ lift, weight: '', reps: '' })),
  );
  return (
    <StepLifts
      method={method}
      lifts={lifts}
      catalog={CATALOG}
      onChange={(index, field, value) =>
        setLifts((prev) =>
          prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
        )
      }
      onAdd={(lift) =>
        setLifts((prev) =>
          prev.some((row) => row.lift === lift)
            ? prev
            : [...prev, { lift, weight: '', reps: '' }],
        )
      }
      onRemove={(index) => setLifts((prev) => prev.filter((_, i) => i !== index))}
    />
  );
}

describe('StepLifts — default rows', () => {
  it('renders the seeded big-three rows with weight and reps inputs', () => {
    render(<Harness />);
    for (const lift of DEFAULT_LIFTS) {
      expect(screen.getByText(lift)).toBeInTheDocument();
      expect(screen.getByLabelText(`${lift} weight`)).toBeInTheDocument();
      expect(screen.getByLabelText(`${lift} reps`)).toBeInTheDocument();
    }
  });
});

describe('StepLifts — add a lift', () => {
  it('appends a catalog lift selected from the picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Overhead Press is not a default row yet
    expect(screen.queryByText('Overhead Press')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Add a lift'), 'overhead');
    await user.click(screen.getByRole('button', { name: 'Overhead Press' }));

    expect(screen.getByText('Overhead Press')).toBeInTheDocument();
    expect(screen.getByLabelText('Overhead Press weight')).toBeInTheDocument();
  });

  it('does not offer lifts that are already added', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Add a lift'), 'squat');
    // 'Squat' is already a default row, so no picker option button for it
    expect(screen.queryByRole('button', { name: 'Squat' })).not.toBeInTheDocument();
  });
});

describe('StepLifts — remove a lift', () => {
  it('drops a row when its remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText('Deadlift')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Deadlift' }));
    expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
  });
});

describe('StepLifts — manual method', () => {
  it('hides the reps input when method is manual', () => {
    render(<Harness method="manual" />);
    expect(screen.getByLabelText('Bench Press weight')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bench Press reps')).not.toBeInTheDocument();
  });
});
