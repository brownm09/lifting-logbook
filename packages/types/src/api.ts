import { LiftName, WeightUnit, WeekNumber, CycleNumber } from './domain';

// ---------------------------------------------------------------------------
// Training Maxes
// ---------------------------------------------------------------------------

/** Serialized training max as returned by the API. */
export interface TrainingMaxResponse {
  lift: LiftName;
  weight: number;
  unit: WeightUnit;
  dateUpdated: string; // ISO 8601 date string
}

/** Request body for updating one or more training maxes. */
export interface UpdateTrainingMaxesRequest {
  maxes: Array<{
    lift: LiftName;
    weight: number;
    unit: WeightUnit;
  }>;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

/** A single set within a workout. */
export interface SetResponse {
  setNum: number;
  weight: number;
  reps: number;
  amrap: boolean;
}

/** A single lift's sets within a workout. */
export interface WorkoutLiftResponse {
  lift: LiftName;
  sets: SetResponse[];
}

/** Serialized workout as returned by the API. */
export interface WorkoutResponse {
  program: string;
  cycleNum: CycleNumber;
  workoutNum: number;
  week: WeekNumber;
  date: string; // ISO 8601 date string
  lifts: WorkoutLiftResponse[];
}

// ---------------------------------------------------------------------------
// Lift Records
// ---------------------------------------------------------------------------

/** Serialized lift record as returned by the API. */
export interface LiftRecordResponse {
  id: string;
  program: string;
  cycleNum: CycleNumber;
  workoutNum: number;
  date: string; // ISO 8601 date string
  lift: LiftName;
  setNum: number;
  weight: number;
  reps: number;
  notes: string;
}

/** Request body for logging a new lift record. */
export interface CreateLiftRecordRequest {
  program: string;
  cycleNum: CycleNumber;
  workoutNum: number;
  date: string; // ISO 8601 date string
  lift: LiftName;
  setNum: number;
  weight: number;
  reps: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Cycle Dashboard
// ---------------------------------------------------------------------------

/** Per-week summary within a cycle dashboard. */
export interface CycleWeekSummary {
  week: WeekNumber;
  workoutDates: string[]; // ISO 8601 date strings
  completed: boolean;
}

/** Serialized cycle dashboard as returned by the API. */
export interface CycleDashboardResponse {
  program: string;
  cycleNum: CycleNumber;
  cycleStartDate: string; // ISO 8601 date string
  weeks: CycleWeekSummary[];
}
