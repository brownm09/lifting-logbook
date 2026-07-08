import {
  MROUND,
  PROG_SPEC_WARMUP_PCTS,
  PROG_SPEC_WORK_PCTS,
  WARMUP_BASE_REPS,
  expandSpecToLength,
  noScheduleWorkoutDateUTC,
  orderedWorkoutKeys,
  programLengthWeeks,
} from '@lifting-logbook/core';
import type { LiftingProgramSpecResponse } from '@lifting-logbook/types';

export interface PlannedSet {
  type: 'warmup' | 'work';
  setLabel: string;
  weight: number;
  reps: number;
}

export interface WorkoutDay {
  workoutNum: number;
  week: number;
  date: string; // YYYY-MM-DD
  lifts: LiftingProgramSpecResponse[];
}

export interface WorkoutCell {
  workoutNum: number;
  date: string; // YYYY-MM-DD
  status: 'completed' | 'upcoming' | 'missed' | 'skipped';
  lifts: { name: string; sets: PlannedSet[] }[];
}

export interface WeekRow {
  week: number;
  workouts: WorkoutCell[];
}

/**
 * Tiles a program's stored block to its canonical length and returns the ordered
 * list of workout days, one per distinct `(week, offset)`, with derived dates.
 *
 * Grouping is by `(week, offset)` — not `offset` alone, which collides workouts
 * that share an offset across weeks (5-3-1's 6 workouts, or a 3-week custom
 * program with every lift at offset 0) into a single card. The stored spec is
 * only one repeating block, so it is first expanded to `programLengthWeeks`
 * (leangains 12 wks, rpt 8, etc.); `program` is optional and falls back to the
 * base-spec block length for custom / unregistered programs.
 *
 * `workoutNum` is a global sequential index over {@link orderedWorkoutKeys} — the
 * same helper the API's no-schedule `weekForWorkoutNum` uses — so a card's
 * `workoutNum` always resolves to the workout it links to (issue #740).
 */
export function buildWorkoutDays(
  specs: LiftingProgramSpecResponse[],
  cycleStartDate: string,
  program?: string,
): WorkoutDay[] {
  const [y, m, d] = cycleStartDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const startDate = new Date(Date.UTC(y, m - 1, d));

  const fullSpec = expandSpecToLength(specs, programLengthWeeks(program ?? '', specs));

  const byKey = new Map<string, LiftingProgramSpecResponse[]>();
  for (const spec of fullSpec) {
    const key = `${spec.week}:${spec.offset}`;
    const lifts = byKey.get(key) ?? [];
    lifts.push(spec);
    byKey.set(key, lifts);
  }

  return orderedWorkoutKeys(fullSpec).map((k, i) => {
    const lifts = (byKey.get(`${k.week}:${k.offset}`) ?? []).sort(
      (a, b) => a.order - b.order,
    );
    return {
      workoutNum: i + 1,
      week: k.week,
      // cycleStart + (week-1)*7 + offset, via the shared core helper the API's
      // no-schedule detail fallback (toWorkoutResponse) also calls — so a card's
      // date can never drift from the workout it opens (issues #740, #745).
      date: noScheduleWorkoutDateUTC(startDate, k.week, k.offset)
        .toISOString()
        .slice(0, 10),
      lifts,
    };
  });
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
    type: 'warmup',
    setLabel: `Warm-up ${i + 1}`,
    weight: MROUND(trainingMax * pct, spec.increment),
    reps: Math.max(1, WARMUP_BASE_REPS - i),
  }));

  const workSets: PlannedSet[] = workPcts.map((pct, i) => ({
    type: 'work',
    setLabel: `Set ${i + 1}`,
    weight: MROUND(trainingMax * pct, spec.increment),
    reps: spec.reps,
  }));

  return [...warmupSets, ...workSets];
}

export interface CycleProgress {
  completedWorkouts: number;
  totalWorkouts: number;
  /** 0–100, rounded to the nearest integer. 0 when totalWorkouts is 0. */
  percent: number;
}

/**
 * Workout-completion progress for the current cycle, derived from the WeekRow[]
 * the dashboard already assembles (see CycleDashboardGrid). Only
 * status === 'completed' counts toward the numerator; skipped and missed
 * workouts still count toward the denominator (they're part of the cycle) but
 * weren't performed, so they don't count as done.
 */
export function computeCycleProgress(weeks: WeekRow[]): CycleProgress {
  let completedWorkouts = 0;
  let totalWorkouts = 0;
  for (const row of weeks) {
    for (const cell of row.workouts) {
      totalWorkouts++;
      if (cell.status === 'completed') completedWorkouts++;
    }
  }
  const percent =
    totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
  return { completedWorkouts, totalWorkouts, percent };
}
