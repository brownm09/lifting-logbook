import { DEFAULT_LIFTS, getSeedLifts } from './lib';

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
