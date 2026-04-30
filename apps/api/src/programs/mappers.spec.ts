import { LiftingProgramSpec } from '@lifting-logbook/core';
import { weekForWorkoutNum } from './mappers';

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
