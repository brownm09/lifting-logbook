import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BrowseTab from './BrowseTab';
import { PROGRAMS } from '@/lib/programs';

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
