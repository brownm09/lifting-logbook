import {
  MROUND,
  PROG_SPEC_WARMUP_PCTS,
  PROG_SPEC_WORK_PCTS,
  WARMUP_BASE_REPS,
  addDaysUTC,
} from '@lifting-logbook/core';
import type { LiftingProgramSpecResponse } from '@lifting-logbook/types';

export interface PlannedSet {
  setLabel: string;
  weight: number;
  reps: number;
}

export interface WorkoutDay {
  workoutNum: number;
  date: string; // YYYY-MM-DD
  lifts: LiftingProgramSpecResponse[];
}

export interface WorkoutCell {
  workoutNum: number;
  date: string; // YYYY-MM-DD
  status: 'completed' | 'upcoming' | 'missed';
  lifts: { name: string; sets: PlannedSet[] }[];
}

export interface WeekRow {
  week: 1 | 2 | 3 | 4;
  workouts: WorkoutCell[];
}

/**
 * Groups program specs by their offset (workout day) and returns an ordered
 * list of workout days with derived dates.
 *
 * Lifts sharing the same offset belong to the same workout session. Offsets
 * are sorted ascending so workoutNum maps 1:1 to chronological order.
 */
export function buildWorkoutDays(
  specs: LiftingProgramSpecResponse[],
  cycleStartDate: string,
): WorkoutDay[] {
  const [y, m, d] = cycleStartDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const startDate = new Date(Date.UTC(y, m - 1, d));

  const byOffset = new Map<number, LiftingProgramSpecResponse[]>();
  for (const spec of specs) {
    const lifts = byOffset.get(spec.offset) ?? [];
    lifts.push(spec);
    byOffset.set(spec.offset, lifts);
  }

  return Array.from(byOffset.keys())
    .sort((a, b) => a - b)
    .map((offset, i) => ({
      workoutNum: i + 1,
      date: addDaysUTC(startDate, offset).toISOString().slice(0, 10),
      lifts: (byOffset.get(offset) ?? []).sort((a, b) => a.order - b.order),
    }));
}

/**
 * Computes planned warmup and work sets for a lift given a training max.
 *
 * Uses PROG_SPEC_WARMUP_PCTS / PROG_SPEC_WORK_PCTS / MROUND from
 * @lifting-logbook/core — the same math as the spreadsheet layer, without
 * the SpreadsheetCell[][] wrapper.
 */
export function computePlannedSets(
  spec: LiftingProgramSpecResponse,
  trainingMax: number,
): PlannedSet[] {
  const warmupPcts = PROG_SPEC_WARMUP_PCTS(spec.warmUpPct).filter(
    (p) => !isNaN(p) && p > 0,
  );
  const workPcts = PROG_SPEC_WORK_PCTS(spec.sets, spec.wtDecrementPct) as number[];

  const warmupSets: PlannedSet[] = warmupPcts.map((pct, i) => ({
    setLabel: `Warm-up ${i + 1}`,
    weight: MROUND(trainingMax * pct, spec.increment),
    reps: WARMUP_BASE_REPS - i,
  }));

  const workSets: PlannedSet[] = workPcts.map((pct, i) => ({
    setLabel: `Set ${i + 1}`,
    weight: MROUND(trainingMax * pct, spec.increment),
    reps: spec.reps,
  }));

  return [...warmupSets, ...workSets];
}
