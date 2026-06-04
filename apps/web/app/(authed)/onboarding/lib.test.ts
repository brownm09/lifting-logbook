import { brzycki1RM, DEFAULT_LIFTS } from './lib';

describe('brzycki1RM', () => {
  it('returns the weight rounded for a single rep', () => {
    expect(brzycki1RM(225, 1)).toBe(225);
    expect(brzycki1RM(225.4, 1)).toBe(225);
  });

  it('estimates a higher 1RM for multi-rep sets', () => {
    // 200 × 5 → 200 × 36 / 32 = 225
    expect(brzycki1RM(200, 5)).toBe(225);
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
