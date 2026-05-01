import type { LiftRecordResponse } from '@lifting-logbook/types';

export interface WarmUpSetData {
  /** Number of reps for this warm-up set. */
  reps: number;
  /**
   * Total planned load in lbs (TM × pct, MROUND'd).
   * For bodyweight-component lifts this is the total load —
   * the UI derives added weight after the bodyweight gate.
   */
  totalLoad: number;
}

export interface WorkingSetData {
  setNum: number;
  /** Total planned load (barbell: bar weight; BW-component: targetLoad). */
  totalLoad: number;
  reps: number;
  amrap: boolean;
  /** Pre-populated when a logged record already exists for this set. */
  existing?: LiftRecordResponse;
}

export interface LiftData {
  lift: string;
  isBodyweightComponent: boolean;
  /**
   * For bodyweight-component lifts, the warm-up implement name shown
   * above the warm-up set list (e.g. "lat pulldown", "dips").
   */
  warmUpImplement?: string;
  warmUpSets: WarmUpSetData[];
  workingSets: WorkingSetData[];
}

export interface WorkoutLoggerProps {
  program: string;
  cycleNum: number;
  workoutNum: number;
  /** ISO date string for this workout (used when creating lift records). */
  date: string;
  lifts: LiftData[];
  hasBodyweightComponent: boolean;
  isReadOnly: boolean;
  /**
   * Body weight (lbs) already recorded for this workout's date, if any.
   * When set, the bodyweight gate is skipped and this value is used directly.
   * When null, the gate fires on first render (unless isReadOnly or !hasBodyweightComponent).
   */
  initialBodyWeight: number | null;
}
