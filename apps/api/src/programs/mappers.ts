import {
  CycleDashboard,
  LiftRecord,
  LiftingProgramSpec,
  TrainingMax,
} from '@lifting-logbook/core';
import {
  CycleDashboardResponse,
  LiftRecordResponse,
  LiftingProgramSpecResponse,
  SetResponse,
  TrainingMaxResponse,
  WeekNumber,
  WorkoutLiftResponse,
  WorkoutResponse,
} from '@lifting-logbook/types';

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
});

// Largest workoutNum whose derived week still fits in WeekNumber (1..4)
// assuming 2 workouts per training week. Real programs vary — when that
// becomes relevant, source week from the program spec instead of deriving.
export const MAX_WORKOUT_NUM = 8 as const;

export const isValidWorkoutNum = (n: number): boolean =>
  Number.isInteger(n) && n >= 1 && n <= MAX_WORKOUT_NUM;

/**
 * Groups a workout's lift records into the WorkoutResponse shape.
 * Assumes 2 workouts per training week; caller must validate `workoutNum`
 * with `isValidWorkoutNum` before invoking.
 */
export const toWorkoutResponse = (
  program: string,
  cycleNum: number,
  workoutNum: number,
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
  const week = Math.ceil(workoutNum / 2) as WeekNumber;
  const date = records[0] ? isoDate(records[0].date) : isoDate(new Date());
  return { program, cycleNum, workoutNum, week, date, lifts };
};
