import {
  PRESET_BASE_SPECS,
  parseProgramSpecFlexible,
  detectPresetSuperset,
  inferProgramFromLiftRecords,
} from '.';

const LIFTS_531 = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press'];
const LIFTS_LEANGAINS = [
  'Bench Press', 'Weighted Pull-ups', 'Incline DB Press', 'Cable Row',
  'Squat', 'Romanian Deadlift', 'Leg Curl', 'Calf Raises',
  'Overhead Press', 'Deadlift', 'Lateral Raises', 'Dips',
];
const LIFTS_RPT = [
  'Bench Press', 'Barbell Row', 'Overhead Press',
  'Squat', 'Romanian Deadlift', 'Calf Raises',
  'Deadlift', 'Weighted Pull-ups', 'Dips',
];

describe('PRESET_BASE_SPECS', () => {
  it('exposes 5-3-1, leangains, and rpt entries', () => {
    expect(Object.keys(PRESET_BASE_SPECS)).toContain('5-3-1');
    expect(Object.keys(PRESET_BASE_SPECS)).toContain('leangains');
    expect(Object.keys(PRESET_BASE_SPECS)).toContain('rpt');
  });

  it('5-3-1 covers the four main lifts across 3 weeks', () => {
    const spec = PRESET_BASE_SPECS['5-3-1'];
    expect(spec).toBeDefined();
    if (!spec) return;
    const lifts = [...new Set(spec.map((r) => r.lift))].sort();
    expect(lifts).toEqual([...LIFTS_531].sort());
    const weeks = [...new Set(spec.map((r) => r.week))].sort();
    expect(weeks).toEqual([1, 2, 3]);
  });

  it('leangains covers three workout days (offsets 0, 2, 4)', () => {
    const spec = PRESET_BASE_SPECS['leangains'];
    expect(spec).toBeDefined();
    if (!spec) return;
    const offsets = [...new Set(spec.map((r) => r.offset))].sort((a, b) => a - b);
    expect(offsets).toEqual([0, 2, 4]);
  });

  it('rpt covers three workout days (offsets 0, 2, 4)', () => {
    const spec = PRESET_BASE_SPECS['rpt'];
    expect(spec).toBeDefined();
    if (!spec) return;
    const offsets = [...new Set(spec.map((r) => r.offset))].sort((a, b) => a - b);
    expect(offsets).toEqual([0, 2, 4]);
  });

  it('rpt includes all 9 expected lifts', () => {
    const spec = PRESET_BASE_SPECS['rpt'];
    expect(spec).toBeDefined();
    if (!spec) return;
    const lifts = [...new Set(spec.map((r) => r.lift))].sort();
    expect(lifts).toEqual([...LIFTS_RPT].sort());
  });

  it('rpt compound RPT sets have amrap:true and wtDecrementPct:0.1', () => {
    const spec = PRESET_BASE_SPECS['rpt'];
    expect(spec).toBeDefined();
    if (!spec) return;
    const rptRows = spec.filter((r) => r.amrap === true);
    expect(rptRows.length).toBeGreaterThan(0);
    for (const row of rptRows) {
      expect(row.wtDecrementPct).toBe(0.1);
    }
  });

  it('rpt Calf Raises are isolation with no decrement', () => {
    const spec = PRESET_BASE_SPECS['rpt'];
    expect(spec).toBeDefined();
    if (!spec) return;
    const calf = spec.find((r) => r.lift === 'Calf Raises');
    expect(calf).toBeDefined();
    expect(calf?.activation).toBe('isolation');
    expect(calf?.amrap).toBe(false);
    expect(calf?.wtDecrementPct).toBe(0);
  });
});

describe('parseProgramSpecFlexible', () => {
  const validRow = {
    week: 1, offset: 0, lift: 'Squat', increment: 5, order: 1,
    sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6',
    wtDecrementPct: 0.1, activation: 'compound',
  };

  it('returns null for an empty array', () => {
    expect(parseProgramSpecFlexible([])).toBeNull();
  });

  it('returns the typed array for valid rows', () => {
    const rows = PRESET_BASE_SPECS['5-3-1'];
    expect(rows).toBeDefined();
    if (!rows) return;
    expect(parseProgramSpecFlexible(rows)).toEqual(rows);
  });

  it('accepts amrap as a string', () => {
    expect(parseProgramSpecFlexible([{ ...validRow, amrap: 'true' }])).not.toBeNull();
  });

  it('returns null when a required field is missing', () => {
    const { lift: _omit, ...noLift } = validRow;
    expect(parseProgramSpecFlexible([noLift])).toBeNull();
  });

  it('returns null when a field has the wrong type', () => {
    expect(parseProgramSpecFlexible([{ ...validRow, week: '1' }])).toBeNull();
  });

  it('returns null if any row is invalid (fails fast)', () => {
    const rows = [validRow, { ...validRow, sets: 'three' }];
    expect(parseProgramSpecFlexible(rows)).toBeNull();
  });

  it('returns null for a null item in the array', () => {
    expect(parseProgramSpecFlexible([null])).toBeNull();
  });

  it('returns null for a primitive item in the array', () => {
    expect(parseProgramSpecFlexible(['string'])).toBeNull();
  });
});

describe('detectPresetSuperset', () => {
  it('returns true when liftHistory contains all 5-3-1 lifts', () => {
    expect(detectPresetSuperset(LIFTS_531, '5-3-1')).toBe(true);
  });

  it('returns true when liftHistory is a strict superset of 5-3-1 lifts', () => {
    expect(detectPresetSuperset([...LIFTS_531, 'Barbell Row', 'Chin-up'], '5-3-1')).toBe(true);
  });

  it('returns false when a required 5-3-1 lift is missing', () => {
    const withoutOhp = LIFTS_531.filter((l) => l !== 'Overhead Press');
    expect(detectPresetSuperset(withoutOhp, '5-3-1')).toBe(false);
  });

  it('returns false for an unknown presetId', () => {
    expect(detectPresetSuperset(LIFTS_531, 'unknown-program')).toBe(false);
  });

  it('returns false for an empty liftHistory when the preset has lifts', () => {
    expect(detectPresetSuperset([], '5-3-1')).toBe(false);
  });

  it('returns true when liftHistory covers all leangains lifts', () => {
    expect(detectPresetSuperset(LIFTS_LEANGAINS, 'leangains')).toBe(true);
  });

  it('returns false for leangains when a unique lift is missing', () => {
    const withoutPullups = LIFTS_LEANGAINS.filter((l) => l !== 'Weighted Pull-ups');
    expect(detectPresetSuperset(withoutPullups, 'leangains')).toBe(false);
  });

  it('returns true when liftHistory covers all rpt lifts', () => {
    expect(detectPresetSuperset(LIFTS_RPT, 'rpt')).toBe(true);
  });

  it('returns false for rpt when Barbell Row is missing', () => {
    const withoutRow = LIFTS_RPT.filter((l) => l !== 'Barbell Row');
    expect(detectPresetSuperset(withoutRow, 'rpt')).toBe(false);
  });
});

describe('inferProgramFromLiftRecords', () => {
  it('returns null for an empty liftHistory', () => {
    expect(inferProgramFromLiftRecords([])).toBeNull();
  });

  it("returns '5-3-1' when history covers exactly those lifts", () => {
    expect(inferProgramFromLiftRecords(LIFTS_531)).toBe('5-3-1');
  });

  it("returns '5-3-1' for a strict superset of those lifts", () => {
    expect(inferProgramFromLiftRecords([...LIFTS_531, 'Barbell Row'])).toBe('5-3-1');
  });

  it("returns 'leangains' when history covers all leangains lifts", () => {
    expect(inferProgramFromLiftRecords(LIFTS_LEANGAINS)).toBe('leangains');
  });

  it("returns 'rpt' when history covers exactly those lifts", () => {
    expect(inferProgramFromLiftRecords(LIFTS_RPT)).toBe('rpt');
  });

  it("returns 'leangains' not 'rpt' when history has both rpt and leangains lifts", () => {
    const combined = [...new Set([...LIFTS_LEANGAINS, ...LIFTS_RPT])];
    expect(inferProgramFromLiftRecords(combined)).toBe('leangains');
  });

  it('returns null when history matches no preset', () => {
    expect(inferProgramFromLiftRecords(['Squat', 'Bench Press'])).toBeNull();
  });

  it('returns null for a single-lift history that matches no preset', () => {
    expect(inferProgramFromLiftRecords(['Squat'])).toBeNull();
  });
});
