import {
  CycleDashboard,
  LiftRecord,
  LiftingProgramSpec,
  TrainingMax,
  TrainingMaxHistoryEntry,
} from '@lifting-logbook/core';
import {
  CycleDashboardResponse,
  CyclePlanResponse,
  LiftRecordResponse,
  LiftingProgramSpecResponse,
  SetResponse,
  TrainingMaxHistoryEntryResponse,
  TrainingMaxResponse,
  WeekNumber,
  WorkoutLiftResponse,
  WorkoutResponse,
} from '@lifting-logbook/types';
import { CyclePlanResult } from '../ports/ICyclePlanningAgent';

// All API date fields are emitted as `YYYY-MM-DD` in UTC. Domain `Date`
// values must be stored as UTC midnight; adapters parsing external sources
// (e.g. Sheets) are responsible for normalizing before the mapper runs.
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const toTrainingMaxResponse = (m: TrainingMax): TrainingMaxResponse => ({
  lift: m.lift,
  weight: m.weight,
  unit: 'lbs',
  dateUpdated: isoDate(m.dateUpdated),
});

export const toTrainingMaxHistoryEntryResponse = (
  e: TrainingMaxHistoryEntry,
): TrainingMaxHistoryEntryResponse => ({
  id: e.id,
  lift: e.lift,
  weight: e.weight,
  unit: 'lbs',
  date: isoDate(e.date),
  isPR: e.isPR,
  source: e.source,
  goalMet: e.goalMet,
});

export const toLiftRecordResponse = (r: LiftRecord): LiftRecordResponse => ({
  id: `${r.program}-${r.cycleNum}-${r.workoutNum}-${r.lift}-${r.setNum}`,
  program: r.program,
  cycleNum: r.cycleNum,
  workoutNum: r.workoutNum,
  date: isoDate(r.date),
  lift: r.lift,
  setNum: r.setNum,
  weight: r.weight,
  reps: r.reps,
  notes: r.notes,
});

export const toLiftingProgramSpecResponse = (
  s: LiftingProgramSpec,
): LiftingProgramSpecResponse => ({
  week: s.week,
  lift: s.lift,
  order: s.order,
  offset: s.offset,
  increment: s.increment,
  sets: s.sets,
  reps: s.reps,
  amrap: typeof s.amrap === 'boolean' ? s.amrap : s.amrap === 'TRUE',
  warmUpPct: s.warmUpPct,
  wtDecrementPct: s.wtDecrementPct,
  activation: s.activation,
});

/**
 * Maps a CycleDashboard to a CycleDashboardResponse.
 * Per-week summary composition (workout dates, completion status) requires
 * combining the dashboard with workouts and lift records — that belongs in a
 * core use case, not the mapper. Returns weeks=[] until that lands.
 */
export const toCycleDashboardResponse = (
  d: CycleDashboard,
): CycleDashboardResponse => ({
  program: d.program,
  cycleNum: d.cycleNum,
  cycleStartDate: isoDate(d.cycleDate),
  weeks: [],
  currentWeekType: d.currentWeekType,
});

export const toCyclePlanResponse = (r: CyclePlanResult): CyclePlanResponse => ({
  proposedChanges: r.proposedChanges.map((c) => ({
    lift: c.lift,
    currentWeight: c.currentWeight,
    proposedWeight: c.proposedWeight,
    reasoning: c.reasoning,
  })),
  overallReasoning: r.overallReasoning,
  partial: r.partial,
  ...(r.partialReason !== undefined && { partialReason: r.partialReason }),
});

export const isValidWorkoutNum = (n: number): boolean =>
  Number.isInteger(n) && n >= 1;

/**
 * Derives the training week for a given workoutNum from the program spec.
 * Deduplicates offsets, sorts ascending, maps workoutNum to the Nth offset,
 * then reads the `week` field from the first matching spec entry (defaulting
 * to 1 when the field is absent). Returns undefined when workoutNum exceeds
 * the number of distinct offsets.
 */
export const weekForWorkoutNum = (
  spec: LiftingProgramSpec[],
  workoutNum: number,
): WeekNumber | undefined => {
  const offsets = [...new Set(spec.map((s) => s.offset))].sort((a, b) => a - b);
  const offset = offsets[workoutNum - 1];
  return offset !== undefined
    ? (spec.find((s) => s.offset === offset)?.week ?? 1)
    : undefined;
};

/**
 * Groups a workout's lift records into the WorkoutResponse shape.
 * Caller must validate `workoutNum` with `isValidWorkoutNum` and derive
 * `week` via `weekForWorkoutNum` before invoking.
 */
export const toWorkoutResponse = (
  program: string,
  cycleNum: number,
  workoutNum: number,
  week: WeekNumber,
  records: LiftRecord[],
): WorkoutResponse => {
  const liftMap = new Map<string, SetResponse[]>();
  for (const r of records) {
    const set: SetResponse = {
      setNum: r.setNum,
      weight: r.weight,
      reps: r.reps,
      amrap: r.notes.toUpperCase().includes('AMRAP'),
    };
    const sets = liftMap.get(r.lift);
    if (sets) sets.push(set);
    else liftMap.set(r.lift, [set]);
  }
  const lifts: WorkoutLiftResponse[] = Array.from(liftMap.entries()).map(
    ([lift, sets]) => ({ lift, sets }),
  );
  const date = records[0] ? isoDate(records[0].date) : isoDate(new Date());
  return { program, cycleNum, workoutNum, week, date, lifts };
};
