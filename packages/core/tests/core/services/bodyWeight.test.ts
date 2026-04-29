import { LIFT_CATALOG, calculateAddedWeight, getBodyweightComponentLifts } from '@src/core';

describe('calculateAddedWeight', () => {
  it('returns positive added weight when target exceeds body weight', () => {
    expect(calculateAddedWeight(100, 80)).toBe(20);
  });

  it('returns zero when target equals body weight', () => {
    expect(calculateAddedWeight(80, 80)).toBe(0);
  });

  it('returns negative value when target is less than body weight', () => {
    expect(calculateAddedWeight(60, 80)).toBe(-20);
  });

  it('handles fractional weights', () => {
    expect(calculateAddedWeight(92.5, 80)).toBeCloseTo(12.5);
  });
});

describe('getBodyweightComponentLifts', () => {
  it('returns chin-up, pull-up, and dip from the real catalog', () => {
    const result = getBodyweightComponentLifts(LIFT_CATALOG);
    const ids = result.map((l) => l.id);
    expect(ids).toContain('chin-up');
    expect(ids).toContain('pull-up');
    expect(ids).toContain('dip');
  });

  it('excludes non-bodyweight lifts', () => {
    const result = getBodyweightComponentLifts(LIFT_CATALOG);
    const ids = result.map((l) => l.id);
    expect(ids).not.toContain('back-squat');
    expect(ids).not.toContain('bench-press');
    expect(ids).not.toContain('deadlift');
    expect(ids).not.toContain('barbell-row');
  });

  it('returns only lifts with isBodyweightComponent === true', () => {
    const result = getBodyweightComponentLifts(LIFT_CATALOG);
    for (const lift of result) {
      expect(lift.isBodyweightComponent).toBe(true);
    }
  });
});
