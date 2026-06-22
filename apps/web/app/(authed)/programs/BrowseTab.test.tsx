import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowseTab from './BrowseTab';
import { PROGRAMS, type Goal } from '@/lib/programs';

/** A goal that no *available* preset satisfies, so selecting it empties the default
 *  (availability-filtered) view. Derived from data + guarded so a future change that
 *  makes every goal available fails loudly here instead of silently passing. */
function findEmptyingGoal(): { goal: Goal; label: RegExp } {
  const availableGoals = new Set(PROGRAMS.filter((p) => p.available).flatMap((p) => p.goals));
  const candidates: { goal: Goal; label: RegExp }[] = [
    { goal: 'fat-loss', label: /fat loss/i },
    { goal: 'body-composition', label: /body composition/i },
  ];
  const emptying = candidates.find((c) => !availableGoals.has(c.goal));
  if (!emptying) {
    throw new Error(
      'Test setup: expected ≥1 goal with no available preset (the empty-tier-view path is unreachable otherwise — update this test if the available set changed)',
    );
  }
  return emptying;
}

// BrowseTab statically imports SwitchProgramDialog, which transitively pulls in
// the server-only `./actions` module (switchProgram). The dialog only renders
// after a "Choose This Program" click and is not under test here, so stub it to
// keep this a pure client render of the filter/availability UI.
jest.mock('./SwitchProgramDialog', () => ({
  __esModule: true,
  default: () => null,
}));

describe('BrowseTab — availability toggle', () => {
  it('hides unavailable programs by default and reveals them via the toggle', async () => {
    const user = userEvent.setup();
    const unavailable = PROGRAMS.find((p) => !p.available);
    if (!unavailable) throw new Error('Test setup: expected ≥1 unavailable program in PROGRAMS');

    render(<BrowseTab activeProgram={null} workoutSchedule={null} />);

    // Hidden by default (the availability filter defaults on).
    expect(screen.queryByText(unavailable.name)).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show coming soon/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(unavailable.name)).toBeInTheDocument();
  });

  it('keeps available programs visible regardless of toggle state', async () => {
    const user = userEvent.setup();
    const available = PROGRAMS.find((p) => p.available);
    if (!available) throw new Error('Test setup: expected ≥1 available program in PROGRAMS');

    render(<BrowseTab activeProgram={null} workoutSchedule={null} />);

    expect(screen.getByText(available.name)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show coming soon/i }));
    expect(screen.getByText(available.name)).toBeInTheDocument();
  });
});

describe('BrowseTab — empty state', () => {
  it('shows a toggle-aware empty state when the active goal hides every available program', async () => {
    const user = userEvent.setup();
    const emptying = findEmptyingGoal();

    render(<BrowseTab activeProgram={null} workoutSchedule={null} />);

    // Default "All Levels" view (the tier-grouped render) shows only available
    // presets; selecting a goal none of them satisfy empties every tier.
    await user.click(screen.getByRole('button', { name: emptying.label }));

    // The empty tier view explains itself and points at the reveal toggle, rather
    // than rendering a blank area below the filters.
    expect(screen.getByText(/turn on .*show coming soon.* to preview/i)).toBeInTheDocument();

    // Revealing unavailable presets clears the hint (matching coming-soon presets appear).
    await user.click(screen.getByRole('button', { name: /show coming soon/i }));
    expect(
      screen.queryByText(/turn on .*show coming soon.* to preview/i),
    ).not.toBeInTheDocument();
  });
});
