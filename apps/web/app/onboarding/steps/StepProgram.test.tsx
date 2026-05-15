import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { StepProgram } from './StepProgram';
import { PROGRAMS, type Experience } from '@/lib/programs';

/** Wrapper that wires up controlled selectedProgramId state so clicking
 *  a program card actually switches to the detail view. */
function Harness({
  experience = 'intermediate' as Experience,
  isPending = false,
  onConfirm = () => {},
}: {
  experience?: Experience;
  isPending?: boolean;
  onConfirm?: () => void;
}) {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  return (
    <StepProgram
      experience={experience}
      selectedProgramId={selectedProgramId}
      isPending={isPending}
      onExperienceChange={() => setSelectedProgramId(null)}
      onSelectProgram={(id) => setSelectedProgramId(id)}
      onClearSelection={() => setSelectedProgramId(null)}
      onConfirm={onConfirm}
    />
  );
}

describe('StepProgram — goal filter', () => {
  it('narrows the visible program list when a goal is selected', async () => {
    const user = userEvent.setup();
    render(<Harness />);

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

describe('StepProgram — confirm wiring', () => {
  it('calls onConfirm when the RPT confirm button is clicked', async () => {
    const user = userEvent.setup();
    const handleConfirm = jest.fn();
    render(<Harness onConfirm={handleConfirm} />);

    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) throw new Error('Test setup: expected RPT program in PROGRAMS');

    await user.click(screen.getByText(rpt.name));
    await user.click(screen.getByRole('button', { name: /choose this program/i }));

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows "Starting…" and disables the confirm button when isPending is true', async () => {
    const user = userEvent.setup();
    const rpt = PROGRAMS.find((p) => p.id === 'rpt');
    if (!rpt) throw new Error('Test setup: expected RPT program in PROGRAMS');

    // Use a Harness variant that exposes isPending as a prop
    function PendingHarness({ isPending }: { isPending: boolean }) {
      const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
      return (
        <StepProgram
          experience={rpt!.experience}
          selectedProgramId={selectedProgramId}
          isPending={isPending}
          onExperienceChange={() => {}}
          onSelectProgram={(id) => setSelectedProgramId(id)}
          onClearSelection={() => setSelectedProgramId(null)}
          onConfirm={() => {}}
        />
      );
    }

    const { rerender } = render(<PendingHarness isPending={false} />);

    // Click RPT to enter detail view
    await user.click(screen.getByText(rpt.name));

    // Button should be enabled before pending
    expect(screen.getByRole('button', { name: /choose this program/i })).not.toBeDisabled();

    // Simulate transition starting
    rerender(<PendingHarness isPending={true} />);

    const confirmBtn = screen.getByRole('button', { name: /starting/i });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveTextContent('Starting…');
  });
});
