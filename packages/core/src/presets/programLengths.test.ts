import {
  PRESET_BASE_SPECS,
  PROGRAM_LENGTHS,
  baseSpecBlockWeeks,
  programLengthWeeks,
  expandSpecToLength,
} from '.';
import { LiftingProgramSpec } from '../models/LiftingProgramSpec';

const makeRow = (
  overrides: Partial<LiftingProgramSpec> = {},
): LiftingProgramSpec => ({
  week: 1,
  offset: 0,
  lift: 'Squat',
  increment: 5,
  order: 1,
  sets: 3,
  reps: 5,
  amrap: true,
  warmUpPct: '0.4,0.5,0.6',
  wtDecrementPct: 0.1,
  activation: 'compound',
  ...overrides,
});

// A synthetic 3-week block: 1 row per week, so tiling math is easy to assert.
const block3 = [
  makeRow({ week: 1, lift: 'A', reps: 5 }),
  makeRow({ week: 2, lift: 'A', reps: 3 }),
  makeRow({ week: 3, lift: 'A', reps: 1 }),
];

// A synthetic 1-week block with two rows (two lifts on one day).
const block1 = [
  makeRow({ week: 1, lift: 'A', offset: 0 }),
  makeRow({ week: 1, lift: 'B', offset: 2 }),
];

// ---------------------------------------------------------------------------
// PROGRAM_LENGTHS registry
// ---------------------------------------------------------------------------

describe('PROGRAM_LENGTHS', () => {
  it('advertises Leangains as a 12-week repeating (autoregulated) program', () => {
    expect(PROGRAM_LENGTHS['leangains']).toEqual({
      lengthWeeks: 12,
      blockWeeks: 1,
      phaseStyle: 'repeating',
    });
  });

  it('advertises RPT as an 8-week repeating program', () => {
    expect(PROGRAM_LENGTHS['rpt']).toEqual({
      lengthWeeks: 8,
      blockWeeks: 1,
      phaseStyle: 'repeating',
    });
  });

  it('advertises 5-3-1 as a 12-week structured (wave) program', () => {
    expect(PROGRAM_LENGTHS['5-3-1']).toEqual({
      lengthWeeks: 12,
      blockWeeks: 3,
      phaseStyle: 'wave',
    });
  });

  it('each registry blockWeeks matches its PRESET_BASE_SPECS block size', () => {
    for (const [program, meta] of Object.entries(PROGRAM_LENGTHS)) {
      const spec = PRESET_BASE_SPECS[program];
      expect(spec).toBeDefined();
      expect(baseSpecBlockWeeks(spec ?? [])).toBe(meta.blockWeeks);
    }
  });

  it('each registry lengthWeeks is a whole multiple of its blockWeeks', () => {
    // Tiling is cleanest when the program length is an exact number of blocks;
    // partial trailing blocks are supported but not intended for built-ins.
    for (const meta of Object.values(PROGRAM_LENGTHS)) {
      expect(meta.lengthWeeks % meta.blockWeeks).toBe(0);
    }
  });

  it('registers a canonical length for every seeded preset', () => {
    // Any program with a PRESET_BASE_SPECS entry is schedulable/planable, so it
    // must also have a canonical length here — otherwise programLengthWeeks silently
    // falls back to the block size and the advertised length collapses (issue #680).
    // This is the reciprocal guard: adding a preset without a length fails loudly.
    for (const program of Object.keys(PRESET_BASE_SPECS)) {
      expect(PROGRAM_LENGTHS[program]).toBeDefined();
    }
  });

  it('every wave program has a multi-week block', () => {
    // buildPhaseTemplate only renders per-wave phases when phaseStyle==='wave' AND
    // blockWeeks>1; a wave program with a 1-week block would silently degrade to a
    // single flat phase. Enforce the contract the plan renderer assumes.
    for (const meta of Object.values(PROGRAM_LENGTHS)) {
      if (meta.phaseStyle === 'wave') expect(meta.blockWeeks).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// baseSpecBlockWeeks
// ---------------------------------------------------------------------------

describe('baseSpecBlockWeeks', () => {
  it('returns 0 for an empty spec', () => {
    expect(baseSpecBlockWeeks([])).toBe(0);
  });

  it('returns the max week present in the block', () => {
    expect(baseSpecBlockWeeks(block1)).toBe(1);
    expect(baseSpecBlockWeeks(block3)).toBe(3);
  });

  it('matches the real Leangains (1) and 5-3-1 (3) presets', () => {
    expect(baseSpecBlockWeeks((PRESET_BASE_SPECS['leangains'] ?? []))).toBe(1);
    expect(baseSpecBlockWeeks((PRESET_BASE_SPECS['5-3-1'] ?? []))).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// programLengthWeeks
// ---------------------------------------------------------------------------

describe('programLengthWeeks', () => {
  it('prefers the canonical registry length over the base-spec block size', () => {
    // Leangains preset is a 1-week block, but the canonical length is 12.
    expect(programLengthWeeks('leangains', (PRESET_BASE_SPECS['leangains'] ?? []))).toBe(12);
    expect(programLengthWeeks('rpt', (PRESET_BASE_SPECS['rpt'] ?? []))).toBe(8);
    expect(programLengthWeeks('5-3-1', (PRESET_BASE_SPECS['5-3-1'] ?? []))).toBe(12);
  });

  it('falls back to the base-spec block size for unregistered programs', () => {
    // Preserves the historical Math.max(...spec.week) behavior for custom programs.
    expect(programLengthWeeks('some-custom-uuid', block3)).toBe(3);
    expect(programLengthWeeks('some-custom-uuid', block1)).toBe(1);
  });

  it('returns 0 for an unregistered program with an empty spec', () => {
    expect(programLengthWeeks('unknown', [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// expandSpecToLength
// ---------------------------------------------------------------------------

describe('expandSpecToLength', () => {
  it('tiles a 1-week block across N weeks with contiguous week numbers', () => {
    const expanded = expandSpecToLength(block1, 12);
    const weeks = [...new Set(expanded.map((r) => r.week))];
    expect(weeks).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    // Two rows per week × 12 weeks.
    expect(expanded).toHaveLength(24);
  });

  it('tiles a 3-week block across 12 weeks (4 waves)', () => {
    const expanded = expandSpecToLength(block3, 12);
    expect(expanded).toHaveLength(12); // 1 row/week × 12
    expect(expanded.map((r) => r.week)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it('repeats block-week attributes at the tiled position', () => {
    const expanded = expandSpecToLength(block3, 12);
    // block week 1 = reps 5, week 2 = reps 3, week 3 = reps 1; repeated every 3.
    const repsByWeek = new Map(expanded.map((r) => [r.week, r.reps]));
    expect(repsByWeek.get(1)).toBe(5);
    expect(repsByWeek.get(4)).toBe(5); // wave 2, block week 1
    expect(repsByWeek.get(5)).toBe(3); // wave 2, block week 2
    expect(repsByWeek.get(12)).toBe(1); // wave 4, block week 3
  });

  it('includes a partial trailing block when length is not a whole multiple', () => {
    const expanded = expandSpecToLength(block3, 8);
    expect(expanded.map((r) => r.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const repsByWeek = new Map(expanded.map((r) => [r.week, r.reps]));
    expect(repsByWeek.get(7)).toBe(5); // block week 1
    expect(repsByWeek.get(8)).toBe(3); // block week 2 (block week 3 truncated away)
  });

  it('preserves all non-week row fields', () => {
    const expanded = expandSpecToLength(block1, 3);
    const first = expanded[0];
    expect(first).toMatchObject({
      lift: 'A',
      offset: 0,
      increment: 5,
      order: 1,
      sets: 3,
      warmUpPct: '0.4,0.5,0.6',
      wtDecrementPct: 0.1,
      activation: 'compound',
    });
  });

  it('is a no-op (returns the same shape) when length equals the block size', () => {
    const expanded = expandSpecToLength(block3, 3);
    expect(expanded.map((r) => ({ week: r.week, reps: r.reps }))).toEqual([
      { week: 1, reps: 5 },
      { week: 2, reps: 3 },
      { week: 3, reps: 1 },
    ]);
  });

  it('returns [] for an empty base spec (zero-spec guard)', () => {
    expect(expandSpecToLength([], 12)).toEqual([]);
  });

  it('returns [] for a non-positive length', () => {
    expect(expandSpecToLength(block1, 0)).toEqual([]);
    expect(expandSpecToLength(block1, -3)).toEqual([]);
  });

  it('does not mutate the input rows', () => {
    const input = [makeRow({ week: 1, lift: 'A' })];
    const snapshot = JSON.stringify(input);
    expandSpecToLength(input, 5);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('expands the real Leangains preset to a full 12-week schedule', () => {
    const base = (PRESET_BASE_SPECS['leangains'] ?? []);
    const expanded = expandSpecToLength(base, 12);
    expect(baseSpecBlockWeeks(expanded)).toBe(12);
    // Same rows per week as the 1-week block, tiled 12×.
    expect(expanded).toHaveLength(base.length * 12);
  });
});
