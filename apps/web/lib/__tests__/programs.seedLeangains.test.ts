import { seedLeangainsSpec, SEED_LEANGAINS } from '../programs';

describe('seedLeangainsSpec', () => {
  const rows = seedLeangainsSpec();

  it('returns 12 rows (4 lifts × 3 days)', () => {
    expect(rows).toHaveLength(12);
  });

  it('all rows have week=1 (single-week repeating template)', () => {
    for (const r of rows) {
      expect(r.week).toBe(1);
    }
  });

  it('covers exactly offsets 0, 2, 4 (Mon/Wed/Fri)', () => {
    const offsets = new Set(rows.map((r) => r.offset));
    expect([...offsets].sort((a, b) => a - b)).toEqual([0, 2, 4]);
  });

  it('satisfies all DTO bounds', () => {
    for (const r of rows) {
      expect([1, 2, 3]).toContain(r.week);
      expect(r.offset).toBeGreaterThanOrEqual(0);
      expect(r.increment).toBeGreaterThan(0);
      expect(r.order).toBeGreaterThanOrEqual(1);
      expect(r.sets).toBeGreaterThanOrEqual(1);
      expect(r.sets).toBeLessThanOrEqual(20);
      expect(r.reps).toBeGreaterThanOrEqual(1);
      expect(r.reps).toBeLessThanOrEqual(20);
      expect(r.wtDecrementPct).toBeGreaterThanOrEqual(0);
      expect(r.wtDecrementPct).toBeLessThanOrEqual(1);
      // 1 − (sets−1)·wtDecrementPct ≥ 0
      expect(1 - (r.sets - 1) * r.wtDecrementPct).toBeGreaterThanOrEqual(0);
    }
  });

  it('has unique (week, offset, lift, order) natural keys', () => {
    const keys = rows.map((r) => `${r.week}:${r.offset}:${r.lift}:${r.order}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('SEED_LEANGAINS matches the leangains program id', () => {
    expect(SEED_LEANGAINS).toBe('leangains');
  });
});
