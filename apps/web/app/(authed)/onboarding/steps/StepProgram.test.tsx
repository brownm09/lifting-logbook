import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { StepProgram } from './StepProgram';
import { PROGRAMS, type Experience, type Goal } from '@/lib/programs';

/** Wrapper that wires up controlled selectedProgramId state so clicking
 *  a program card actually switches to the detail view. */
function Harness({
  experience = 'intermediate' as Experience,
  onAdvance = () => {},
}: {
  experience?: Experience;
  onAdvance?: () => void;
}) {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  return (
    <StepProgram
      experience={experience}
      selectedProgramId={selectedProgramId}
      onExperienceChange={() => setSelectedProgramId(null)}
      onSelectProgram={(id) => setSelectedProgramId(id)}
      onClearSelection={() => setSelectedProgramId(null)}
      onAdvance={onAdvance}
    />
  );
}

describe('StepProgram — goal filter', () => {
  it('narrows the visible program list when a goal is selected', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Unavailable presets are hidden by default; reveal them so this test
    // exercises goal-filtering across the full intermediate set.
    await user.click(screen.getByRole('button', { name: /show coming soon/i }));

    // Before filtering: all intermediate programs should be visible
    const intermediatePrograms = PROGRAMS.filter((p) => p.experience === 'intermediate');
    for (const p of intermediatePrograms) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }

    // Click the "💪 Strength" goal filter
    await user.click(screen.getByRole('button', { name: /strength/i }));

    // Programs that include 'strength' in goals should still appear
    const strengthPrograms = intermediatePrograms.filter((p) =>
      p.goals.includes('strength'),
    );
    for (const p of strengthPrograms) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }

    // Programs that do NOT include 'strength' in goals should be gone
    const nonStrengthPrograms = intermediatePrograms.filter(
      (p) => !p.goals.includes('strength'),
    );
    // Guard: this test only validates filtering when there are programs to exclude
    if (nonStrengthPrograms.length > 0) {
      for (const p of nonStrengthPrograms) {
        expect(screen.queryByText(p.name)).not.toBeInTheDocument();
      }
    }
  });
});

describe('StepProgram — coming soon overlay', () => {
  it('disables the confirm button and shows a coming-soon note for non-RPT programs', async () => {
    const user = userEvent.setup();
    const unavailableProgram = PROGRAMS.find(
      (p) => p.experience === 'intermediate' && !p.available,
    );
    if (!unavailableProgram) {
      throw new Error(
        'Test setup: expected ≥1 unavailable intermediate program in PROGRAMS',
      );
    }

    render(<Harness />);

    // Unavailable presets are hidden by default; reveal them to open this one's detail.
    await user.click(screen.getByRole('button', { name: /show coming soon/i }));

    // Click on the unavailable program to enter detail view
    await user.click(screen.getByText(unavailableProgram.name));

    // The "Choose This Program" button should be disabled
    const confirmBtn = screen.getByRole('button', { name: /choose this program/i });
    expect(confirmBtn).toBeDisabled();

    // A "coming soon" note should be visible
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it('does not show coming-soon note for the RPT program', async () => {
    const user = userEvent.setup();

    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) {
      throw new Error('Test setup: expected RPT program in PROGRAMS');
    }

    render(<Harness experience={rpt.experience} />);
    await user.click(screen.getByText(rpt.name));

    // The confirm button should NOT be disabled
    const confirmBtn = screen.getByRole('button', { name: /choose this program/i });
    expect(confirmBtn).not.toBeDisabled();

    // No coming-soon note
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });
});

describe('StepProgram — advance wiring', () => {
  it('calls onAdvance when the RPT confirm button is clicked', async () => {
    const user = userEvent.setup();
    const handleAdvance = jest.fn();
    render(<Harness onAdvance={handleAdvance} />);

    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) throw new Error('Test setup: expected RPT program in PROGRAMS');

    await user.click(screen.getByText(rpt.name));
    await user.click(screen.getByRole('button', { name: /choose this program/i }));

    expect(handleAdvance).toHaveBeenCalledTimes(1);
  });
});

describe('StepProgram — availability toggle', () => {
  it('hides unavailable programs by default and reveals them via the toggle', async () => {
    const user = userEvent.setup();
    const unavailable = PROGRAMS.find(
      (p) => p.experience === 'intermediate' && !p.available,
    );
    if (!unavailable) {
      throw new Error('Test setup: expected ≥1 unavailable intermediate program in PROGRAMS');
    }

    render(<Harness />);

    // Hidden by default (the availability filter defaults on).
    expect(screen.queryByText(unavailable.name)).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show coming soon/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Revealing the toggle surfaces the unavailable program.
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(unavailable.name)).toBeInTheDocument();
  });

  it('keeps the available RPT program visible regardless of toggle state', async () => {
    const user = userEvent.setup();
    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) throw new Error('Test setup: expected RPT program in PROGRAMS');

    render(<Harness experience={rpt.experience} />);

    expect(screen.getByText(rpt.name)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show coming soon/i }));
    expect(screen.getByText(rpt.name)).toBeInTheDocument();
  });
});

describe('StepProgram — leangains availability', () => {
  it('shows leangains without enabling the coming-soon toggle', async () => {
    const user = userEvent.setup();
    // Leangains is intermediate; default Harness experience is intermediate.
    render(<Harness />);

    // Leangains visible in the default tier view without touching the toggle.
    expect(screen.getByText('Leangains (Berkhan)')).toBeInTheDocument();

    // Also visible in the full catalog.
    await user.click(screen.getByRole('button', { name: /view full catalog/i }));
    expect(screen.getByText('Leangains (Berkhan)')).toBeInTheDocument();
  });
});

describe('StepProgram — goal coverage guard', () => {
  it('every goal has at least one available program', () => {
    // Guard: if a new goal is added to the Goal type without a matching available program,
    // this test fails loudly. Update the available set or this assertion when goals expand.
    const availableGoals = new Set(
      PROGRAMS.filter((p) => p.available).flatMap((p) => p.goals),
    );
    const ALL_GOALS: Goal[] = ['strength', 'muscle-gain', 'fat-loss', 'body-composition'];
    for (const g of ALL_GOALS) {
      expect(availableGoals.has(g)).toBe(true);
    }
  });
});
