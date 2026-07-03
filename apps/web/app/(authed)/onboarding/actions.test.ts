jest.mock('@/lib/api', () => ({
  switchProgram: jest.fn(),
  updateTrainingMaxes: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { switchProgram, updateTrainingMaxes } from '@/lib/api';
import { createFirstCycle } from './actions';

const mockedSwitchProgram = switchProgram as unknown as jest.Mock;
const mockedUpdateTrainingMaxes = updateTrainingMaxes as unknown as jest.Mock;

describe('createFirstCycle', () => {
  beforeEach(() => jest.clearAllMocks());

  // Regression test for #650: completing onboarding must set activeProgram (via
  // switchProgram), not just create the cycle — otherwise the dashboard page's
  // getActiveProgram() lookup resolves to the wrong program and 404s even though
  // the cycle was created successfully.
  it('redirects to /cycle/1 using the cycleNum switchProgram returns (genuine first-time setup)', async () => {
    mockedSwitchProgram.mockResolvedValue({ activeProgram: 'leangains', cycleNum: 1 });

    await expect(createFirstCycle('leangains', [])).rejects.toThrow('REDIRECT:/cycle/1');
    expect(mockedSwitchProgram).toHaveBeenCalledWith('leangains');
  });

  // Proves the redirect target is not hardcoded — switchProgram returns the
  // existing cycleNum when a cycle already exists, and the redirect must follow it.
  it('redirects to the returned cycleNum, not a hardcoded /cycle/1', async () => {
    mockedSwitchProgram.mockResolvedValue({ activeProgram: 'leangains', cycleNum: 3 });

    await expect(createFirstCycle('leangains', [])).rejects.toThrow('REDIRECT:/cycle/3');
  });

  it('persists confirmed training maxes after switchProgram succeeds', async () => {
    mockedSwitchProgram.mockResolvedValue({ activeProgram: 'leangains', cycleNum: 1 });
    mockedUpdateTrainingMaxes.mockResolvedValue(undefined);

    await expect(
      createFirstCycle('leangains', [{ lift: 'Squat', trainingMax: 315 }]),
    ).rejects.toThrow('REDIRECT:/cycle/1');

    expect(mockedUpdateTrainingMaxes).toHaveBeenCalledWith('leangains', {
      maxes: [{ lift: 'Squat', weight: 315, unit: 'lbs' }],
    });
  });

  it('rejects a program that is not available', async () => {
    const result = await createFirstCycle('not-a-real-program', []);

    expect(result).toEqual({ ok: false, error: 'That program is not yet available.' });
    expect(mockedSwitchProgram).not.toHaveBeenCalled();
  });

  it('returns a generic error and does not redirect when switchProgram fails', async () => {
    mockedSwitchProgram.mockRejectedValue(new Error('API down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await createFirstCycle('leangains', []);

    expect(result).toEqual({
      ok: false,
      error: 'Failed to start your program. Please try again.',
    });
    errSpy.mockRestore();
  });
});
