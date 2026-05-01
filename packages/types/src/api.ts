import { BodyWeightEntry, LiftName, WeightUnit, WeekNumber, CycleNumber, WeekType } from './domain';

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
  bodyWeightEntry?: Pick<BodyWeightEntry, 'weight' | 'unit'>;
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

/** Request body for updating an existing lift record (in-session editing). */
export interface UpdateLiftRecordRequest {
  weight?: number;
  reps?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Body Weight
// ---------------------------------------------------------------------------

/** Request body for recording a body weight observation. */
export interface RecordBodyWeightRequest {
  date: string; // ISO 8601 date string
  weight: number;
  unit: WeightUnit;
}

/** Serialized body weight entry as returned by the API. */
export interface BodyWeightResponse {
  date: string; // ISO 8601 date string ("YYYY-MM-DD")
  weight: number;
  unit: WeightUnit;
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
  currentWeekType: WeekType;
}

// ---------------------------------------------------------------------------
// Cycle Planning Agent
// ---------------------------------------------------------------------------

/** A single proposed training-max change within a cycle plan. */
export interface ProposedTrainingMaxChangeResponse {
  lift: LiftName;
  currentWeight: number;
  proposedWeight: number;
  reasoning: string;
}

/** Result of a cycle planning agent run. */
export interface CyclePlanResponse {
  proposedChanges: ProposedTrainingMaxChangeResponse[];
  overallReasoning: string;
  partial: boolean;
  partialReason?: string;
}

// ---------------------------------------------------------------------------
// Lifting Program Spec
// ---------------------------------------------------------------------------

/** Per-lift specification within a lifting program (e.g., 5/3/1). */
export interface LiftingProgramSpecResponse {
  week: number;
  lift: LiftName;
  order: number;
  offset: number;
  increment: number;
  sets: number;
  reps: number;
  amrap: boolean;
  warmUpPct: string;
  wtDecrementPct: number;
  activation: string;
}
