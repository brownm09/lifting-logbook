import { brzycki1RM, DEFAULT_LIFTS, floorToIncrement, getSeedLifts } from './lib';

describe('floorToIncrement', () => {
  it('leaves an exact multiple of the increment unchanged', () => {
    expect(floorToIncrement(315)).toBe(315);
    expect(floorToIncrement(317.5)).toBe(317.5);
  });

  it('floors down to the nearest lower multiple (default 2.5)', () => {
    expect(floorToIncrement(316.9)).toBe(315);
    expect(floorToIncrement(203)).toBe(202.5);
  });

  it('respects a custom increment', () => {
    expect(floorToIncrement(23, 5)).toBe(20);
  });
});

describe('brzycki1RM', () => {
  it('floors the weight to the nearest 2.5 for a single rep', () => {
    expect(brzycki1RM(225, 1)).toBe(225);
    expect(brzycki1RM(225.4, 1)).toBe(225);
    // Distinguishes floor-to-2.5 from round-to-nearest: 203 rounds to 203 but
    // floors to 202.5.
    expect(brzycki1RM(203, 1)).toBe(202.5);
  });

  it('estimates a higher 1RM for multi-rep sets, floored to the nearest 2.5', () => {
    // 200 × 5 → 200 × 36 / 32 = 225 (already an exact multiple of 2.5)
    expect(brzycki1RM(200, 5)).toBe(225);
    // 210 × 3 → 210 × 36 / 34 = 222.35... rounds to 222 but floors to 220.
    expect(brzycki1RM(210, 3)).toBe(220);
  });

  it('returns 0 for non-positive weight or reps', () => {
    expect(brzycki1RM(0, 5)).toBe(0);
    expect(brzycki1RM(200, 0)).toBe(0);
    expect(brzycki1RM(-10, 5)).toBe(0);
    expect(brzycki1RM(200, -3)).toBe(0);
  });

  it('returns 0 at and beyond the formula asymptote (reps ≥ 37)', () => {
    expect(brzycki1RM(200, 37)).toBe(0);
    expect(brzycki1RM(200, 40)).toBe(0);
  });
});

describe('DEFAULT_LIFTS', () => {
  it('seeds the catalog-named big three', () => {
    expect(DEFAULT_LIFTS).toEqual(['Bench Press', 'Squat', 'Deadlift']);
  });
});

describe('getSeedLifts', () => {
  it('returns empty array for undefined spec (unmapped program)', () => {
    expect(getSeedLifts(undefined)).toEqual([]);
  });

  it('returns empty array for empty spec array', () => {
    expect(getSeedLifts([])).toEqual([]);
  });

  it('returns deduped ordered LiftRows from spec', () => {
    const spec = [
      { lift: 'Squat' },
      { lift: 'Bench Press' },
      { lift: 'Squat' }, // duplicate — dropped
    ];
    expect(getSeedLifts(spec)).toEqual([
      { lift: 'Squat', weight: '', reps: '' },
      { lift: 'Bench Press', weight: '', reps: '' },
    ]);
  });

  it('preserves first-occurrence order from the spec', () => {
    const spec = [
      { lift: 'Deadlift' },
      { lift: 'Overhead Press' },
      { lift: 'Bench Press' },
    ];
    const result = getSeedLifts(spec);
    expect(result.map((r) => r.lift)).toEqual(['Deadlift', 'Overhead Press', 'Bench Press']);
  });
});
