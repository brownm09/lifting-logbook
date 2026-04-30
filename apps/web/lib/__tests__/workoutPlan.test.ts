import type { LiftingProgramSpecResponse } from '@lifting-logbook/types';
import { buildWorkoutDays, computePlannedSets } from '../workoutPlan';

const makeSpec = (
  overrides: Partial<LiftingProgramSpecResponse>,
): LiftingProgramSpecResponse => ({
  lift: 'Squat',
  order: 1,
  offset: 0,
  increment: 5,
  sets: 3,
  reps: 5,
  amrap: false,
  warmUpPct: '0.4,0.5,0.6',
  wtDecrementPct: 0,
  activation: '',
  ...overrides,
});

describe('buildWorkoutDays', () => {
  it('groups specs by offset and assigns workoutNum 1-based in offset order', () => {
    const specs: LiftingProgramSpecResponse[] = [
      makeSpec({ lift: 'Squat', offset: 0, order: 1 }),
      makeSpec({ lift: 'Bench Press', offset: 0, order: 2 }),
      makeSpec({ lift: 'Deadlift', offset: 2, order: 1 }),
    ];

    const days = buildWorkoutDays(specs, '2026-01-05');

    expect(days).toHaveLength(2);
    expect(days[0]?.workoutNum).toBe(1);
    expect(days[0]?.lifts.map((l) => l.lift)).toEqual(['Squat', 'Bench Press']);
    expect(days[1]?.workoutNum).toBe(2);
    expect(days[1]?.lifts.map((l) => l.lift)).toEqual(['Deadlift']);
  });

  it('computes workout dates by adding offset days to cycleStartDate in UTC', () => {
    const specs = [
      makeSpec({ offset: 0 }),
      makeSpec({ lift: 'Bench Press', offset: 3 }),
    ];

    const days = buildWorkoutDays(specs, '2026-01-05');

    expect(days[0]?.date).toBe('2026-01-05');
    expect(days[1]?.date).toBe('2026-01-08');
  });

  it('sorts lifts within a workout day by order field', () => {
    const specs = [
      makeSpec({ lift: 'B', offset: 0, order: 2 }),
      makeSpec({ lift: 'A', offset: 0, order: 1 }),
    ];

    const days = buildWorkoutDays(specs, '2026-01-01');

    expect(days[0]?.lifts.map((l) => l.lift)).toEqual(['A', 'B']);
  });

  it('handles end-of-month date arithmetic correctly', () => {
    const specs = [makeSpec({ offset: 3 })];
    const days = buildWorkoutDays(specs, '2026-01-30');
    expect(days[0]?.date).toBe('2026-02-02');
  });
});

describe('computePlannedSets', () => {
  it('computes warmup and work sets from training max', () => {
    const spec = makeSpec({
      warmUpPct: '0.4,0.5,0.6',
      sets: 3,
      reps: 5,
      wtDecrementPct: 0,
      increment: 5,
    });

    const sets = computePlannedSets(spec, 200);

    const warmups = sets.filter((s) => s.setLabel.startsWith('Warm-up'));
    const worksets = sets.filter((s) => s.setLabel.startsWith('Set'));

    expect(warmups).toHaveLength(3);
    expect(warmups[0]).toMatchObject({ weight: 80, reps: 5 }); // 200 * 0.4 = 80
    expect(warmups[1]).toMatchObject({ weight: 100, reps: 4 }); // 200 * 0.5 = 100
    expect(warmups[2]).toMatchObject({ weight: 120, reps: 3 }); // 200 * 0.6 = 120

    expect(worksets).toHaveLength(3);
    expect(worksets[0]).toMatchObject({ weight: 200, reps: 5 }); // 200 * 1.0
  });

  it('rounds weights to the nearest increment using MROUND', () => {
    const spec = makeSpec({ warmUpPct: '0.4', sets: 1, wtDecrementPct: 0, increment: 5 });
    const sets = computePlannedSets(spec, 205);
    // 205 * 0.4 = 82 → MROUND(82, 5) = 80
    expect(sets[0]?.weight).toBe(80);
    // 205 * 1.0 = 205 → MROUND(205, 5) = 205
    expect(sets[1]?.weight).toBe(205);
  });

  it('applies weight decrement across work sets', () => {
    const spec = makeSpec({
      warmUpPct: '',
      sets: 3,
      reps: 8,
      wtDecrementPct: 0.05,
      increment: 2.5,
    });

    const sets = computePlannedSets(spec, 100);
    const worksets = sets.filter((s) => s.setLabel.startsWith('Set'));

    expect(worksets[0]?.weight).toBe(100); // 100 * 1.0
    expect(worksets[1]?.weight).toBe(95); // 100 * 0.95 = 95 → MROUND(95, 2.5) = 95
    expect(worksets[2]?.weight).toBe(90); // 100 * 0.90 = 90 → MROUND(90, 2.5) = 90
  });

  it('omits warmup sets when warmUpPct is empty', () => {
    const spec = makeSpec({ warmUpPct: '', sets: 2, wtDecrementPct: 0 });
    const sets = computePlannedSets(spec, 100);
    expect(sets.every((s) => s.setLabel.startsWith('Set'))).toBe(true);
  });
});
