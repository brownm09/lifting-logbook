import {
  DEFAULT_STRENGTH_STANDARDS,
  evaluateStrengthTier,
} from '@src/core';

describe('evaluateStrengthTier', () => {
  it('returns achieved=true when trainingMax meets threshold', () => {
    const result = evaluateStrengthTier(160, 100, 1.6);
    expect(result.achieved).toBe(true);
  });

  it('returns achieved=true when trainingMax exceeds threshold', () => {
    const result = evaluateStrengthTier(200, 100, 1.6);
    expect(result.achieved).toBe(true);
  });

  it('returns achieved=false when trainingMax is below threshold', () => {
    const result = evaluateStrengthTier(150, 100, 1.6);
    expect(result.achieved).toBe(false);
  });

  it('returns correct progressRatio below threshold', () => {
    const result = evaluateStrengthTier(80, 100, 1.6);
    expect(result.progressRatio).toBeCloseTo(0.5);
  });

  it('returns progressRatio of 1.0 exactly at threshold', () => {
    const result = evaluateStrengthTier(160, 100, 1.6);
    expect(result.progressRatio).toBeCloseTo(1.0);
  });

  it('returns progressRatio above 1.0 when threshold is exceeded', () => {
    const result = evaluateStrengthTier(200, 100, 1.6);
    expect(result.progressRatio).toBeGreaterThan(1.0);
  });

  it('multiplierOverride scenario: user override of 1.4 instead of system 1.6', () => {
    const result = evaluateStrengthTier(150, 100, 1.4);
    expect(result.achieved).toBe(true);
    expect(result.progressRatio).toBeCloseTo(150 / 140);
  });

  it('returns progressRatio of 0 when bodyweight is 0', () => {
    const result = evaluateStrengthTier(100, 0, 1.6);
    expect(result.progressRatio).toBe(0);
  });
});

describe('DEFAULT_STRENGTH_STANDARDS', () => {
  const standardFor = (liftId: string, tier: string) =>
    DEFAULT_STRENGTH_STANDARDS.find((s) => s.liftId === liftId && s.tier === tier);

  it('covers all five lifts across all three tiers (15 entries)', () => {
    expect(DEFAULT_STRENGTH_STANDARDS).toHaveLength(15);
  });

  it('has correct squat multipliers', () => {
    expect(standardFor('back-squat', 'intermediate')?.multiplier).toBe(1.6);
    expect(standardFor('back-squat', 'advanced')?.multiplier).toBe(2.0);
    expect(standardFor('back-squat', 'elite')?.multiplier).toBe(2.4);
  });

  it('has correct bench press multipliers', () => {
    expect(standardFor('bench-press', 'intermediate')?.multiplier).toBe(1.2);
    expect(standardFor('bench-press', 'advanced')?.multiplier).toBe(1.5);
    expect(standardFor('bench-press', 'elite')?.multiplier).toBe(1.8);
  });

  it('has correct chin-up multipliers', () => {
    expect(standardFor('chin-up', 'intermediate')?.multiplier).toBe(1.2);
    expect(standardFor('chin-up', 'advanced')?.multiplier).toBe(1.5);
    expect(standardFor('chin-up', 'elite')?.multiplier).toBe(1.8);
  });

  it('has correct deadlift multipliers', () => {
    expect(standardFor('deadlift', 'intermediate')?.multiplier).toBe(2.0);
    expect(standardFor('deadlift', 'advanced')?.multiplier).toBe(2.5);
    expect(standardFor('deadlift', 'elite')?.multiplier).toBe(3.0);
  });

  it('has correct overhead press multipliers', () => {
    expect(standardFor('overhead-press', 'intermediate')?.multiplier).toBe(0.75);
    expect(standardFor('overhead-press', 'advanced')?.multiplier).toBe(1.0);
    expect(standardFor('overhead-press', 'elite')?.multiplier).toBe(1.25);
  });
});
