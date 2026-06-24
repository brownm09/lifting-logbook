import { LiftingProgramSpec } from '../models/LiftingProgramSpec';

export const PRESET_BASE_SPECS: Record<string, LiftingProgramSpec[]> = {
  // leangains is defined first: it requires 12 unique lifts vs 5-3-1's 4, so inferProgramFromLiftRecords
  // checks the more-specific preset first and avoids misclassifying leangains users as 5-3-1.
  leangains: [
    // Day A — offset 0 (Mon: Chest / Back)
    { week: 1, offset: 0, lift: 'Bench Press',       order: 1, sets: 3, reps: 6,  amrap: true,  increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 1, offset: 0, lift: 'Weighted Pull-ups', order: 2, sets: 3, reps: 6,  amrap: true,  increment: 2.5, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 1, offset: 0, lift: 'Incline DB Press',  order: 3, sets: 3, reps: 8,  amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
    { week: 1, offset: 0, lift: 'Cable Row',         order: 4, sets: 3, reps: 10, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
    // Day B — offset 2 (Wed: Legs)
    { week: 1, offset: 2, lift: 'Squat',             order: 1, sets: 3, reps: 6,  amrap: true,  increment: 10,  warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 1, offset: 2, lift: 'Romanian Deadlift', order: 2, sets: 3, reps: 8,  amrap: false, increment: 10,  warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
    { week: 1, offset: 2, lift: 'Leg Curl',          order: 3, sets: 3, reps: 10, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'isolation' },
    { week: 1, offset: 2, lift: 'Calf Raises',       order: 4, sets: 4, reps: 12, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'isolation' },
    // Day C — offset 4 (Fri: Shoulders / Arms)
    { week: 1, offset: 4, lift: 'Overhead Press',    order: 1, sets: 3, reps: 6,  amrap: true,  increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 1, offset: 4, lift: 'Deadlift',          order: 2, sets: 1, reps: 5,  amrap: false, increment: 10,  warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
    { week: 1, offset: 4, lift: 'Lateral Raises',    order: 3, sets: 4, reps: 12, amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'isolation' },
    { week: 1, offset: 4, lift: 'Dips',              order: 4, sets: 3, reps: 8,  amrap: false, increment: 5,   warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0,   activation: 'compound' },
  ],
  '5-3-1': [
    // Week 1: 3×5 (65/75/85% TM)
    { week: 1, offset: 0, lift: 'Squat',         increment: 5,  order: 1, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 1, offset: 0, lift: 'Bench Press',    increment: 5,  order: 2, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 1, offset: 3, lift: 'Deadlift',       increment: 10, order: 1, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 1, offset: 3, lift: 'Overhead Press', increment: 5,  order: 2, sets: 3, reps: 5, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    // Week 2: 3×3 (70/80/90% TM)
    { week: 2, offset: 0, lift: 'Squat',         increment: 5,  order: 1, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 2, offset: 0, lift: 'Bench Press',    increment: 5,  order: 2, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 2, offset: 3, lift: 'Deadlift',       increment: 10, order: 1, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 2, offset: 3, lift: 'Overhead Press', increment: 5,  order: 2, sets: 3, reps: 3, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    // Week 3: 5/3/1 (75/85/95% TM, last set AMRAP)
    { week: 3, offset: 0, lift: 'Squat',         increment: 5,  order: 1, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 3, offset: 0, lift: 'Bench Press',    increment: 5,  order: 2, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 3, offset: 3, lift: 'Deadlift',       increment: 10, order: 1, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
    { week: 3, offset: 3, lift: 'Overhead Press', increment: 5,  order: 2, sets: 3, reps: 1, amrap: true, warmUpPct: '0.4,0.5,0.6', wtDecrementPct: 0.1, activation: 'compound' },
  ],
};

function isLiftingProgramSpec(row: unknown): row is LiftingProgramSpec {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r['week'] === 'number' &&
    typeof r['offset'] === 'number' &&
    typeof r['lift'] === 'string' &&
    (r['lift'] as string).length > 0 &&
    typeof r['increment'] === 'number' &&
    typeof r['order'] === 'number' &&
    typeof r['sets'] === 'number' &&
    typeof r['reps'] === 'number' &&
    (typeof r['amrap'] === 'string' || typeof r['amrap'] === 'boolean') &&
    typeof r['warmUpPct'] === 'string' &&
    typeof r['wtDecrementPct'] === 'number' &&
    typeof r['activation'] === 'string'
  );
}

export function parseProgramSpecFlexible(rows: unknown[]): LiftingProgramSpec[] | null {
  if (!rows.length) return null;
  const result: LiftingProgramSpec[] = [];
  for (const row of rows) {
    if (!isLiftingProgramSpec(row)) return null;
    result.push(row);
  }
  return result;
}

export function detectPresetSuperset(liftHistory: string[], presetId: string): boolean {
  const spec = PRESET_BASE_SPECS[presetId];
  if (!spec) return false;
  const presetLifts = [...new Set(spec.map((row) => row.lift as string))];
  return presetLifts.every((lift) => liftHistory.includes(lift));
}

export function inferProgramFromLiftRecords(liftHistory: string[]): string | null {
  for (const presetId of Object.keys(PRESET_BASE_SPECS)) {
    if (detectPresetSuperset(liftHistory, presetId)) return presetId;
  }
  return null;
}
