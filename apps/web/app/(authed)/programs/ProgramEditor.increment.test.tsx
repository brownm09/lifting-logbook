import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProgramEditor from './ProgramEditor';

// ProgramEditor statically imports the server-only ./actions module and next/navigation's
// router; neither is exercised by these tests (no Save click), so both are stubbed to keep
// this a pure client render of the spec-seeding behavior.
jest.mock('./actions', () => ({
  createCustomProgram: jest.fn(),
  updateCustomProgram: jest.fn(),
  switchProgram: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

function renderNew(defaultWeightIncrement: number | null) {
  render(
    <ProgramEditor
      mode="new"
      activeProgram={null}
      defaultWeightIncrement={defaultWeightIncrement}
      onSaved={() => {}}
      onCancel={() => {}}
    />,
  );
}

async function selectFirstLift(user: ReturnType<typeof userEvent.setup>) {
  const checkboxes = screen.getAllByRole('checkbox');
  await user.click(checkboxes[0]!);
}

describe('ProgramEditor — new spec rows seed from the configured weight increment', () => {
  it('seeds new rows with the user-configured default', async () => {
    const user = userEvent.setup();
    renderNew(0.625);
    await selectFirstLift(user);

    const incrementInputs = screen.getAllByDisplayValue('0.625');
    // One row per week (3) for the single selected lift.
    expect(incrementInputs).toHaveLength(3);
  });

  it('falls back to 1.25 when no default is configured yet', async () => {
    const user = userEvent.setup();
    renderNew(null);
    await selectFirstLift(user);

    const incrementInputs = screen.getAllByDisplayValue('1.25');
    expect(incrementInputs).toHaveLength(3);
  });
});
