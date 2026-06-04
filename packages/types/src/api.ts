import { BodyWeightEntry, LiftClassification, LiftName, MovementProfile, WeightUnit, WeekNumber, CycleNumber, WeekType } from './domain';

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

/** A TM reduction that was blocked and requires explicit user review (mirrors core's MaxReductionFlag). */
export interface MaxReductionFlagResponse {
  lift: LiftName;
  currentWeight: number;
  proposedWeight: number;
}

/** Response from POST /training-maxes/recalculate. */
export interface RecalculateMaxesResponse {
  maxes: TrainingMaxResponse[];
  /** Lifts whose computed new TM would be lower than the current TM — not auto-applied. */
  flagged: MaxReductionFlagResponse[];
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
// Training Max History
// ---------------------------------------------------------------------------

export type TrainingMaxHistorySource = 'test' | 'program';

/** A single entry in the training max history timeline. */
export interface TrainingMaxHistoryEntryResponse {
  id: string;
  lift: LiftName;
  weight: number;
  unit: WeightUnit;
  date: string; // ISO 8601 date string
  isPR: boolean;
  source: TrainingMaxHistorySource;
  goalMet: boolean;
}

/** Response from GET /training-maxes/history. */
export interface TrainingMaxHistoryResponse {
  entries: TrainingMaxHistoryEntryResponse[];
}

/** Request body for PATCH /training-maxes/history/:id. */
export interface UpdateTrainingMaxHistoryRequest {
  isPR?: boolean;
  goalMet?: boolean;
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
  /** True when derived from the program spec with no logged sets yet; false when backed by real records. */
  planned: boolean;
}

/** Serialized workout as returned by the API. */
export interface WorkoutResponse {
  program: string;
  cycleNum: CycleNumber;
  workoutNum: number;
  week: WeekNumber;
  date: string; // ISO 8601 date string
  overrideDate?: string; // ISO 8601 date string; present when the user has rescheduled
  skipped: boolean;
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
  /** ISO 8601 date string. When omitted the server uses the scheduled date for this workout, falling back to today. */
  date?: string;
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
// Strength Goals
// ---------------------------------------------------------------------------

/** Serialized strength goal as returned by the API. */
export interface StrengthGoalResponse {
  lift: string;
  goalType: 'absolute' | 'relative';
  target?: number;
  unit: 'lbs' | 'kg';
  ratio?: number;
  updatedAt: string; // ISO 8601 date string
}

/** Request body for PUT /programs/:program/strength-goals/:lift. */
export interface UpsertStrengthGoalRequest {
  goalType: 'absolute' | 'relative';
  target?: number;
  unit: 'lbs' | 'kg';
  ratio?: number;
}

// ---------------------------------------------------------------------------
// Cycle Dashboard
// ---------------------------------------------------------------------------

/** Per-workout entry within a cycle week summary. */
export interface WorkoutSummary {
  workoutNum: number;
  date: string; // ISO 8601 scheduled date
  skipped: boolean;
}

/** Per-week summary within a cycle dashboard. */
export interface CycleWeekSummary {
  week: WeekNumber;
  workouts: WorkoutSummary[];
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

// ---------------------------------------------------------------------------
// Lift Overrides (Manage Lifts)
// ---------------------------------------------------------------------------

export type LiftOverrideAction = 'add' | 'remove' | 'replace';

/** Request body for POST /programs/:program/cycles/:cycleNum/workouts/:workoutNum/lift-overrides. */
export interface CreateLiftOverrideRequest {
  action: LiftOverrideAction;
  lift: string;
  /** Required when action is 'replace'. */
  replacedBy?: string;
}

/** A single lift override as returned by the API. */
export interface LiftOverrideResponse {
  action: LiftOverrideAction;
  lift: string;
  replacedBy?: string;
}

// ---------------------------------------------------------------------------
// Lift Metadata
// ---------------------------------------------------------------------------

/** Per-user lift metadata as returned by GET /lifts/:lift/metadata. */
export interface LiftMetadataResponse {
  lift: string;
  muscleGroups: string[];
  substitutions: string[];
  foundational: boolean;
}

/** Request body for PATCH /lifts/:lift/metadata. */
export interface PatchLiftMetadataRequest {
  muscleGroups?: string[];
  substitutions?: string[];
  foundational?: boolean;
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

// ---------------------------------------------------------------------------
// User Settings
// ---------------------------------------------------------------------------

/**
 * Day-of-week convention used throughout the schedule subsystem.
 * 0 = Monday … 6 = Sunday.
 *
 * IMPORTANT: do NOT use JavaScript's `Date.getDay()` directly — it returns
 * 0=Sunday. Convert via `(d.getDay() + 6) % 7` to land in this convention.
 */
export const DAY_INDEX = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
  SUN: 6,
} as const;

/** Upper bounds enforced at both the write (DTO) and read (parseSchedule) boundaries. */
export const SCHEDULE_LIMITS = {
  MAX_DAYS_PER_WEEK: 7,
  MAX_ROTATING_WEEKS: 8,
} as const;

export interface UserWorkoutSchedule {
  type: 'fixed' | 'rotating';
  /** For fixed schedules: array of day indices using `DAY_INDEX` (0=Mon … 6=Sun). */
  days?: number[];
  /** For rotating schedules: array of week patterns, each containing day indices. */
  weeks?: number[][];
}

/**
 * Single source of truth for `UserWorkoutSchedule` shape validation.
 * Used by the API DTO write-side check and the repository read-side guard
 * so the two boundaries cannot drift (e.g., upper bounds tightened in only
 * one place). Returns the value narrowed to `UserWorkoutSchedule` when valid.
 */
export function isValidSchedule(value: unknown): value is UserWorkoutSchedule {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as { type?: unknown; days?: unknown; weeks?: unknown };
  const isDayIdx = (d: unknown): d is number =>
    Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6;

  if (v.type === 'fixed') {
    if (v.weeks !== undefined) return false;
    if (!Array.isArray(v.days)) return false;
    if (v.days.length < 1 || v.days.length > SCHEDULE_LIMITS.MAX_DAYS_PER_WEEK) return false;
    const seen = new Set<number>();
    for (const d of v.days) {
      if (!isDayIdx(d) || seen.has(d)) return false;
      seen.add(d);
    }
    return true;
  }

  if (v.type === 'rotating') {
    if (v.days !== undefined) return false;
    if (!Array.isArray(v.weeks)) return false;
    if (v.weeks.length < 1 || v.weeks.length > SCHEDULE_LIMITS.MAX_ROTATING_WEEKS) return false;
    for (const week of v.weeks) {
      if (!Array.isArray(week)) return false;
      if (week.length < 1 || week.length > SCHEDULE_LIMITS.MAX_DAYS_PER_WEEK) return false;
      const seen = new Set<number>();
      for (const d of week) {
        if (!isDayIdx(d) || seen.has(d)) return false;
        seen.add(d);
      }
    }
    return true;
  }

  return false;
}

export interface UserSettingsResponse {
  activeProgram: string | null;
  workoutSchedule: UserWorkoutSchedule | null;
}

export interface UpdateUserSettingsRequest {
  workoutSchedule?: UserWorkoutSchedule | null;
}

// ---------------------------------------------------------------------------
// Custom Programs
// ---------------------------------------------------------------------------

export interface CustomProgramSpecRow {
  week: number;
  offset: number;
  lift: string;
  increment: number;
  order: number;
  sets: number;
  reps: number;
  amrap: boolean;
  warmUpPct: string;
  wtDecrementPct: number;
  activation: string;
  weekType?: string;
}

export interface CustomProgramResponse {
  id: string;
  name: string;
  description: string | null;
  baseTemplate: string | null;
  createdAt: string;
  specs: CustomProgramSpecRow[];
}

export interface CustomProgramSummaryResponse {
  id: string;
  name: string;
  description: string | null;
  baseTemplate: string | null;
  createdAt: string;
}

export interface CreateCustomProgramRequest {
  name: string;
  description?: string;
  baseTemplate?: string;
  specs: CustomProgramSpecRow[];
}

export interface UpdateCustomProgramRequest {
  name?: string;
  description?: string;
  specs?: CustomProgramSpecRow[];
}

export interface SwitchProgramResponse {
  activeProgram: string;
  cycleNum: number;
}

// ---------------------------------------------------------------------------
// Lift Record CSV Import
// ---------------------------------------------------------------------------

/** A single validation error from a CSV import attempt. */
export interface ImportError {
  /** 1-based data row number (excludes the header row). */
  row: number;
  /** Which field failed, if determinable. */
  field?: string;
  message: string;
}

/** A row that was silently skipped because its natural key already exists. */
export interface SkippedRecord {
  /**
   * 1-based data row number, counting only data rows (the CSV header is excluded).
   * Row 1 is the first data row immediately after the header.
   */
  row: number;
  /**
   * Stringified natural key identifying the skipped set, in the format:
   * `"<cycleNum>:<workoutNum>:<lift>:<setNum>"`
   *
   * All four components use the canonical (post-import, post-slot-map) values.
   * Example: `"3:2:bench-press:1"` means cycle 3, workout 2, bench-press, set 1.
   */
  naturalKey: string;
}

/** Response body for a successful POST /programs/:program/lift-records/import. */
export interface ImportLiftRecordsResponse {
  /** Number of rows actually inserted (excludes duplicates that were skipped). */
  written: number;
  /**
   * Rows that were not inserted because their natural key already exists in the database.
   * Empty array when there are no duplicates.
   *
   * Note: lift abbreviations (e.g. "Bench P.") are resolved to canonical lift IDs
   * (e.g. "bench-press") before the natural key is computed, so the values here
   * reflect the stored canonical IDs, not the original CSV values.
   *
   * Programs do not restrict which lifts may be imported. Preloaded template programs
   * become custom programs when edited; custom programs have no lift restrictions.
   */
  skipped: SkippedRecord[];
}

// ---------------------------------------------------------------------------
// Custom Lifts
// ---------------------------------------------------------------------------

/** Serialized custom lift as returned by the API. `userId` is intentionally omitted. */
export interface CustomLiftResponse {
  id: string; // uuid — the REST key
  name: string;
  classification: LiftClassification;
  movementProfile: MovementProfile;
  isBodyweightComponent: boolean;
  isCustom: true;
  createdAt: string; // ISO 8601 date string
}

/** Request body for POST /lifts/custom. */
export interface CreateCustomLiftRequest {
  name: string;
  classification: LiftClassification;
  movementProfile?: MovementProfile;
  isBodyweightComponent?: boolean;
}

/** Request body for PATCH /lifts/custom/:id. All fields optional. */
export interface UpdateCustomLiftRequest {
  name?: string;
  classification?: LiftClassification;
  movementProfile?: MovementProfile;
  isBodyweightComponent?: boolean;
}
