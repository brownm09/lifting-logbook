import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowseTab from './BrowseTab';
import { PROGRAMS, type Goal } from '@/lib/programs';

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
  it('shows the toggle-aware hint when an experience filter hides all available programs', async () => {
    const user = userEvent.setup();
    // Both available programs (RPT, Leangains) are 'intermediate'. Clicking 'Beginner'
    // leaves zero available programs visible; unavailable beginner programs (Starting
    // Strength, StrongLifts) exist, so hiddenUnavailableCount > 0 and the hint renders.
    render(<BrowseTab activeProgram={null} workoutSchedule={null} />);

    await user.click(screen.getByRole('button', { name: /^beginner$/i }));

    expect(
      screen.getByText(/turn on.*show coming soon.*to preview/i),
    ).toBeInTheDocument();
  });
});

describe('BrowseTab — leangains availability', () => {
  it('shows leangains without enabling the coming-soon toggle', () => {
    render(<BrowseTab activeProgram={null} workoutSchedule={null} />);
    expect(screen.getByText('Leangains (Berkhan)')).toBeInTheDocument();
  });
});

describe('BrowseTab — goal coverage guard', () => {
  it('every goal has at least one available program', () => {
    // Guard: if a new goal is added to the Goal type without a matching available program,
    // this test fails loudly. Update the available set or this assertion when goals expand.
    const availableGoals = new Set(PROGRAMS.filter((p) => p.available).flatMap((p) => p.goals));
    const ALL_GOALS: Goal[] = ['strength', 'muscle-gain', 'fat-loss', 'body-composition'];
    for (const g of ALL_GOALS) {
      expect(availableGoals.has(g)).toBe(true);
    }
  });
});
