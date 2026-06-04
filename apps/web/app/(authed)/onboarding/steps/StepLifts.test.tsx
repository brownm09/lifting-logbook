import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
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
  it('exposes combobox role and aria-expanded on the search input', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Add a lift' });
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows available catalog lifts when the input is focused with no query', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Before focus: no picker items visible
    expect(screen.queryByRole('option', { name: 'Overhead Press' })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Add a lift'));

    // After focus with empty query: unselected catalog lifts appear immediately
    expect(screen.getByRole('option', { name: 'Overhead Press' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Barbell Row' })).toBeInTheDocument();
    // Already-selected lifts are not offered
    expect(screen.queryByRole('option', { name: 'Squat' })).not.toBeInTheDocument();
  });

  it('appends a catalog lift selected from the picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Overhead Press is not a default row yet
    expect(screen.queryByText('Overhead Press')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Add a lift'), 'overhead');
    await user.click(screen.getByRole('option', { name: 'Overhead Press' }));

    expect(screen.getByText('Overhead Press')).toBeInTheDocument();
    expect(screen.getByLabelText('Overhead Press weight')).toBeInTheDocument();
  });

  it('does not offer lifts that are already added', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Add a lift'), 'squat');
    // 'Squat' is already a default row, so no picker option for it
    expect(screen.queryByRole('option', { name: 'Squat' })).not.toBeInTheDocument();
  });

  it('adds a free-text custom lift that is not in the catalog', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 'Zercher Carry' is not in CATALOG — the picker should offer it as custom
    await user.type(screen.getByLabelText('Add a lift'), 'Zercher Carry');
    await user.click(
      screen.getByRole('option', { name: /Add .*Zercher Carry.* as a custom lift/i }),
    );

    expect(screen.getByText('Zercher Carry')).toBeInTheDocument();
    expect(screen.getByLabelText('Zercher Carry weight')).toBeInTheDocument();
  });

  it('does not offer a custom-add when the query exactly matches a catalog lift', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 'Overhead Press' is a catalog lift not yet added — it is offered as a
    // normal catalog option, never as a "custom lift".
    await user.type(screen.getByLabelText('Add a lift'), 'Overhead Press');
    expect(screen.getByRole('option', { name: 'Overhead Press' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /as a custom lift/i }),
    ).not.toBeInTheDocument();
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
