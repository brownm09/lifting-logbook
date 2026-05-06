import { LiftingProgramSpec } from '@lifting-logbook/core';
import { applyLiftOverrides, toWorkoutResponse, weekForWorkoutNum } from './mappers';
import { LiftOverride } from '../ports/IWorkoutLiftOverrideRepository';

const baseFields: Omit<LiftingProgramSpec, 'offset' | 'lift' | 'week'> = {
  increment: 5,
  order: 1,
  sets: 3,
  reps: 5,
  amrap: true,
  warmUpPct: '0.4,0.5,0.6',
  wtDecrementPct: 0.1,
  activation: 'compound',
};

const spec = (offset: number, lift: string, week?: number): LiftingProgramSpec => ({
  ...baseFields,
  offset,
  lift: lift as LiftingProgramSpec['lift'],
  ...(week !== undefined ? { week } : {}),
});

describe('weekForWorkoutNum', () => {
  it('returns 1 (default) when spec has no week field and workoutNum is 1', () => {
    const s = [spec(0, 'Squat'), spec(0, 'Bench Press')];
    expect(weekForWorkoutNum(s, 1)).toBe(1);
  });

  it('returns undefined for empty spec', () => {
    expect(weekForWorkoutNum([], 1)).toBeUndefined();
  });

  it('returns undefined when workoutNum exceeds distinct offset count', () => {
    const s = [spec(0, 'Squat'), spec(2, 'Deadlift')];
    expect(weekForWorkoutNum(s, 3)).toBeUndefined();
  });

  it('returns explicit week value when spec entries carry week', () => {
    const s = [spec(0, 'Squat', 1), spec(2, 'Deadlift', 1), spec(4, 'OHP', 2)];
    expect(weekForWorkoutNum(s, 3)).toBe(2);
  });

  it('correctly maps workoutNum across multiple distinct offsets', () => {
    const s = [
      spec(0, 'Squat', 1),
      spec(0, 'Bench Press', 1),
      spec(2, 'Deadlift', 1),
      spec(4, 'OHP', 2),
    ];
    expect(weekForWorkoutNum(s, 1)).toBe(1);
    expect(weekForWorkoutNum(s, 2)).toBe(1);
    expect(weekForWorkoutNum(s, 3)).toBe(2);
    expect(weekForWorkoutNum(s, 4)).toBeUndefined();
  });

  it('deduplicates offsets — two lifts at the same offset count as one workout', () => {
    const s = [spec(0, 'Squat', 1), spec(0, 'Bench Press', 1), spec(7, 'Deadlift', 2)];
    expect(weekForWorkoutNum(s, 1)).toBe(1);
    expect(weekForWorkoutNum(s, 2)).toBe(2);
    expect(weekForWorkoutNum(s, 3)).toBeUndefined();
  });

  it('uses ?? 1 fallback when first matching spec entry has no week field', () => {
    const s = [spec(0, 'Squat'), spec(7, 'Deadlift')];
    expect(weekForWorkoutNum(s, 1)).toBe(1);
    expect(weekForWorkoutNum(s, 2)).toBe(1);
  });
});

describe('applyLiftOverrides', () => {
  const lifts = ['Squat', 'Bench Press', 'Deadlift'];

  it('returns spec lifts unchanged when no overrides', () => {
    expect(applyLiftOverrides(lifts, [])).toEqual(lifts);
  });

  it('remove — drops the target lift', () => {
    const o: LiftOverride[] = [{ lift: 'Bench Press', action: 'remove' }];
    expect(applyLiftOverrides(lifts, o)).toEqual(['Squat', 'Deadlift']);
  });

  it('remove — no-op when lift is not in list', () => {
    const o: LiftOverride[] = [{ lift: 'Overhead Press', action: 'remove' }];
    expect(applyLiftOverrides(lifts, o)).toEqual(lifts);
  });

  it('replace — swaps in-place preserving order', () => {
    const o: LiftOverride[] = [{ lift: 'Bench Press', action: 'replace', replacedBy: 'Dips' }];
    expect(applyLiftOverrides(lifts, o)).toEqual(['Squat', 'Dips', 'Deadlift']);
  });

  it('replace without replacedBy — no-op (invalid but defensively handled)', () => {
    const o: LiftOverride[] = [{ lift: 'Bench Press', action: 'replace' }];
    expect(applyLiftOverrides(lifts, o)).toEqual(lifts);
  });

  it('add — appends new lift', () => {
    const o: LiftOverride[] = [{ lift: 'Chin-up', action: 'add' }];
    expect(applyLiftOverrides(lifts, o)).toEqual([...lifts, 'Chin-up']);
  });

  it('add — no-op when lift already present', () => {
    const o: LiftOverride[] = [{ lift: 'Squat', action: 'add' }];
    expect(applyLiftOverrides(lifts, o)).toEqual(lifts);
  });

  it('combined — remove, replace, add applied in order', () => {
    const o: LiftOverride[] = [
      { lift: 'Squat', action: 'remove' },
      { lift: 'Bench Press', action: 'replace', replacedBy: 'Dips' },
      { lift: 'Chin-up', action: 'add' },
    ];
    expect(applyLiftOverrides(lifts, o)).toEqual(['Dips', 'Deadlift', 'Chin-up']);
  });
});

describe('toWorkoutResponse with plannedLifts', () => {
  const program = '5-3-1';
  const cycleNum = 1;
  const workoutNum = 1;
  const week = 1;

  const record = (lift: string, setNum: number, weight: number) => ({
    program,
    cycleNum,
    workoutNum,
    date: new Date('2026-05-07T00:00:00Z'),
    lift,
    setNum,
    weight,
    reps: 5,
    notes: '',
  });

  it('marks logged lifts as planned:false', () => {
    const records = [record('Squat', 1, 200)];
    const result = toWorkoutResponse(program, cycleNum, workoutNum, week, records, undefined, ['Squat']);
    expect(result.lifts[0]).toMatchObject({ lift: 'Squat', planned: false });
    expect(result.lifts[0]?.sets).toHaveLength(1);
  });

  it('marks unlogged planned lifts as planned:true with empty sets', () => {
    const result = toWorkoutResponse(program, cycleNum, workoutNum, week, [], undefined, ['Squat', 'Bench Press']);
    expect(result.lifts).toHaveLength(2);
    expect(result.lifts[0]).toMatchObject({ lift: 'Squat', sets: [], planned: true });
    expect(result.lifts[1]).toMatchObject({ lift: 'Bench Press', sets: [], planned: true });
  });

  it('appends logged lifts not in planned list as planned:false', () => {
    const records = [record('Squat', 1, 200), record('Chin-up', 1, 0)];
    const result = toWorkoutResponse(program, cycleNum, workoutNum, week, records, undefined, ['Squat']);
    expect(result.lifts).toHaveLength(2);
    expect(result.lifts[0]).toMatchObject({ lift: 'Squat', planned: false });
    expect(result.lifts[1]).toMatchObject({ lift: 'Chin-up', planned: false });
  });

  it('without plannedLifts — all logged lifts get planned:false (legacy behaviour)', () => {
    const records = [record('Squat', 1, 200)];
    const result = toWorkoutResponse(program, cycleNum, workoutNum, week, records);
    expect(result.lifts[0]).toMatchObject({ lift: 'Squat', planned: false });
  });
});
