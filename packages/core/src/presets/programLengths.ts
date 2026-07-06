import { WeekNumber } from '@lifting-logbook/types';
import { LiftingProgramSpec } from '../models/LiftingProgramSpec';

/**
 * How a program's weeks are periodized for plan display.
 *
 * - 'repeating': autoregulated / repeating-block programs (Leangains, RPT). Every
 *   week is a training week; progression is AMRAP-driven (via `updateMaxes` from
 *   actual lift records), not a fixed weekly bump. Rendered as a single flat
 *   "Training" span — never a fabricated deload/test week.
 * - 'wave': structured, periodized programs (5/3/1). The repeating block is a
 *   wave; the plan shows one training phase per wave.
 */
export type ProgramPhaseStyle = 'repeating' | 'wave';

export interface ProgramLengthMeta {
  /** Authoritative total program length in weeks — the single source of truth. */
  lengthWeeks: number;
  /** Size of the repeating block in {@link PRESET_BASE_SPECS} (its max `week`). */
  blockWeeks: number;
  /** Plan-display periodization style. */
  phaseStyle: ProgramPhaseStyle;
}

/**
 * Canonical program-length registry — the single source of truth for how long a
 * built-in program runs and how it is periodized. Both API schedule generation
 * (`cycle-generation.service.ts`) and web onboarding copy (`apps/web/lib/programs.ts`)
 * derive from this, replacing three previously-disagreeing sources: the onboarding
 * `weeks` literal, the 1-week preset block, and the `Math.max(...spec.week)`-derived
 * duration (which collapsed Leangains to "1 total week"). See issue #680.
 *
 * Keyed by the same program IDs as {@link PRESET_BASE_SPECS}. Programs without an
 * entry (custom user programs, not-yet-wired presets) fall back to their base-spec
 * block length via {@link programLengthWeeks}, preserving the historical
 * `Math.max(...spec.week)` behavior.
 */
export const PROGRAM_LENGTHS: Record<string, ProgramLengthMeta> = {
  // 1-week repeating block tiled across 12 weeks; autoregulated (RPT + IF protocol).
  leangains: { lengthWeeks: 12, blockWeeks: 1, phaseStyle: 'repeating' },
  // 1-week repeating block tiled across 8 weeks; autoregulated (reverse-pyramid).
  rpt: { lengthWeeks: 8, blockWeeks: 1, phaseStyle: 'repeating' },
  // 3-week 5/3/1 wave tiled across 12 weeks (4 waves); structured / periodized.
  '5-3-1': { lengthWeeks: 12, blockWeeks: 3, phaseStyle: 'wave' },
};

/**
 * The size of a base spec's repeating block: the max `week` present in the rows
 * (0 for an empty spec). Reads `week` only, so it accepts both the domain
 * {@link LiftingProgramSpec} and its serialized `LiftingProgramSpecResponse`.
 */
export function baseSpecBlockWeeks(
  spec: ReadonlyArray<{ week: WeekNumber }>,
): number {
  return spec.reduce((max, s) => Math.max(max, s.week), 0);
}

/**
 * The authoritative program length in weeks. Prefers the canonical
 * {@link PROGRAM_LENGTHS} registry; falls back to the base-spec block size for
 * programs without an entry — this preserves the historical
 * `Math.max(...spec.week)` behavior for custom / unregistered programs.
 */
export function programLengthWeeks(
  program: string,
  spec: ReadonlyArray<{ week: WeekNumber }>,
): number {
  return PROGRAM_LENGTHS[program]?.lengthWeeks ?? baseSpecBlockWeeks(spec);
}

/**
 * Tiles a base spec (one repeating block) across `lengthWeeks` by repeating the
 * block's rows with incremented `week` numbers. Read-time expansion only — stored
 * specs are never mutated, so there is no DB migration and revert is a pure code
 * change (see issue #680). The block size is the max `week` present in `baseSpec`.
 *
 * Week numbering is contiguous `1..lengthWeeks`. A partial trailing block is
 * included: e.g. a 3-week block across 8 weeks yields weeks 1..8 with the final
 * block truncated at week 8 (weeks 7,8 = block weeks 1,2).
 *
 * Returns `[]` for an empty base spec (zero-spec guard) or `lengthWeeks <= 0`,
 * so callers computing `Math.max(...expanded.map(s => s.week))` must still guard
 * the empty case (`Math.max(...[])` is `-Infinity`).
 */
export function expandSpecToLength(
  baseSpec: LiftingProgramSpec[],
  lengthWeeks: number,
): LiftingProgramSpec[] {
  const blockWeeks = baseSpecBlockWeeks(baseSpec);
  if (blockWeeks <= 0 || lengthWeeks <= 0) return [];

  // Group rows by their in-block week once, preserving each week's row order.
  const rowsByWeek = new Map<number, LiftingProgramSpec[]>();
  for (const row of baseSpec) {
    const arr = rowsByWeek.get(row.week) ?? [];
    arr.push(row);
    rowsByWeek.set(row.week, arr);
  }

  const expanded: LiftingProgramSpec[] = [];
  for (let week = 1; week <= lengthWeeks; week++) {
    const blockWeek = ((week - 1) % blockWeeks) + 1;
    for (const row of rowsByWeek.get(blockWeek) ?? []) {
      expanded.push({ ...row, week });
    }
  }
  return expanded;
}
