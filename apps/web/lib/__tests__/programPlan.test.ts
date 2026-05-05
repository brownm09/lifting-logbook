import type { CycleWeekSummary, LiftingProgramSpecResponse } from '@lifting-logbook/types';
import { deriveProgramPhases, deriveProgramSummary } from '../programPlan';

const makeWeek = (
  week: number,
  workoutDates: string[],
  completed: boolean,
): CycleWeekSummary => ({ week, workoutDates, completed });

const makeSpec = (
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
  activation: '',
  ...overrides,
});

// ---------------------------------------------------------------------------
// deriveProgramPhases
// ---------------------------------------------------------------------------

describe('deriveProgramPhases', () => {
  const weeks12 = Array.from({ length: 12 }, (_, i) =>
    makeWeek(i + 1, [`2026-01-${String(i * 7 + 1).padStart(2, '0')}`], false),
  );

  it('returns 6 phases for a 12-week input', () => {
    const phases = deriveProgramPhases(weeks12, '2025-01-01');
    expect(phases).toHaveLength(6);
  });

  it('phase names match the 5-3-1 block sequence', () => {
    const phases = deriveProgramPhases(weeks12, '2025-01-01');
    expect(phases.map((p) => p.name)).toEqual([
      'Accumulation',
      'Deload',
      'Intensification',
      'Deload',
      'Realization',
      'Test',
    ]);
  });

  it('phase types are correct', () => {
    const phases = deriveProgramPhases(weeks12, '2025-01-01');
    expect(phases.map((p) => p.type)).toEqual([
      'training',
      'deload',
      'training',
      'deload',
      'training',
      'test',
    ]);
  });

  it('status is completed when all weeks in phase are completed', () => {
    const completedWeeks = [
      makeWeek(1, ['2026-01-01'], true),
      makeWeek(2, ['2026-01-08'], true),
      makeWeek(3, ['2026-01-15'], true),
      ...Array.from({ length: 9 }, (_, i) =>
        makeWeek(i + 4, ['2099-01-01'], false),
      ),
    ];
    const phases = deriveProgramPhases(completedWeeks, '2026-02-01');
    expect(phases[0]?.status).toBe('completed');
  });

  it('status is in-progress when phase has past dates but not all weeks completed', () => {
    const today = '2026-01-10';
    const inProgressWeeks = [
      makeWeek(1, ['2026-01-01'], true),
      makeWeek(2, ['2026-01-08'], false),
      makeWeek(3, ['2026-01-15'], false),
      ...Array.from({ length: 9 }, (_, i) =>
        makeWeek(i + 4, ['2099-01-01'], false),
      ),
    ];
    const phases = deriveProgramPhases(inProgressWeeks, today);
    expect(phases[0]?.status).toBe('in-progress');
  });

  it('status is upcoming when no workout dates have passed', () => {
    const futureWeeks = Array.from({ length: 12 }, (_, i) =>
      makeWeek(i + 1, ['2099-01-01'], false),
    );
    const phases = deriveProgramPhases(futureWeeks, '2026-01-01');
    expect(phases.every((p) => p.status === 'upcoming')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deriveProgramSummary
// ---------------------------------------------------------------------------

describe('deriveProgramSummary', () => {
  it('returns durationWeeks as the max week in specs', () => {
    const specs = [makeSpec({ week: 1 }), makeSpec({ week: 12 }), makeSpec({ week: 7 })];
    expect(deriveProgramSummary(specs).durationWeeks).toBe(12);
  });

  it('counts unique offsets in week 1 for frequency', () => {
    const specs = [
      makeSpec({ week: 1, offset: 0 }),
      makeSpec({ week: 1, offset: 2, lift: 'Bench Press' }),
      makeSpec({ week: 1, offset: 4, lift: 'Deadlift' }),
      makeSpec({ week: 2, offset: 0 }),
    ];
    expect(deriveProgramSummary(specs).frequency).toBe(3);
  });

  it('returns unique exercise names preserving insertion order', () => {
    const specs = [
      makeSpec({ lift: 'Squat', week: 1 }),
      makeSpec({ lift: 'Bench Press', week: 1 }),
      makeSpec({ lift: 'Squat', week: 2 }),
      makeSpec({ lift: 'Deadlift', week: 1 }),
    ];
    expect(deriveProgramSummary(specs).exercises).toEqual([
      'Squat',
      'Bench Press',
      'Deadlift',
    ]);
  });

  it('derives warmUpSets from comma-separated warmUpPct on first week-1 spec', () => {
    const specs = [makeSpec({ week: 1, warmUpPct: '0.4,0.5,0.6' })];
    expect(deriveProgramSummary(specs).warmUpSets).toBe(3);
  });

  it('returns 0 warmUpSets when warmUpPct is empty', () => {
    const specs = [makeSpec({ week: 1, warmUpPct: '' })];
    expect(deriveProgramSummary(specs).warmUpSets).toBe(0);
  });

  it('returns working sets from first week-1 spec sets field', () => {
    const specs = [makeSpec({ week: 1, sets: 5 })];
    expect(deriveProgramSummary(specs).workingSets).toBe(5);
  });
});
