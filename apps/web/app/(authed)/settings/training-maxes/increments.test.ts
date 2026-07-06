import type { LiftingProgramSpecResponse } from '@lifting-logbook/types';
import { resolveStepIncrements } from './increments';

const spec = (
  overrides: Partial<LiftingProgramSpecResponse>,
): LiftingProgramSpecResponse => ({
  week: 1,
  lift: 'Squat',
  order: 1,
  offset: 0,
  increment: 5,
  sets: 3,
  reps: 5,
  amrap: false,
  warmUpPct: '0.4,0.5,0.6',
  wtDecrementPct: 0,
  activation: 'compound',
  ...overrides,
});

describe('resolveStepIncrements', () => {
  it("uses each lift's configured per-program increment", () => {
    const specs = [
      spec({ lift: 'Squat', increment: 10 }),
      spec({ lift: 'Weighted Pull-ups', increment: 2.5 }),
      spec({ lift: 'Bench Press', increment: 5 }),
    ];

    expect(
      resolveStepIncrements(
        ['Squat', 'Weighted Pull-ups', 'Bench Press'],
        specs,
        1.25,
      ),
    ).toEqual({ Squat: 10, 'Weighted Pull-ups': 2.5, 'Bench Press': 5 });
  });

  it('falls back to the default increment for a lift with no spec row', () => {
    // Deadlift has a training max but is not in the active program's specs
    // (e.g. a stale max left over from a previously-active program).
    const specs = [spec({ lift: 'Squat', increment: 10 })];

    const steps = resolveStepIncrements(['Squat', 'Deadlift'], specs, 1.25);

    expect(steps.Squat).toBe(10);
    expect(steps.Deadlift).toBe(1.25);
  });

  it('takes the first spec row per lift (increment is constant across weeks)', () => {
    const specs = [
      spec({ lift: 'Squat', week: 1, increment: 10 }),
      spec({ lift: 'Squat', week: 2, increment: 10 }),
    ];

    expect(resolveStepIncrements(['Squat'], specs, 1.25)).toEqual({ Squat: 10 });
  });

  it('falls back for every lift when the program has no specs', () => {
    expect(resolveStepIncrements(['Squat', 'Bench Press'], [], 2.5)).toEqual({
      Squat: 2.5,
      'Bench Press': 2.5,
    });
  });
});
