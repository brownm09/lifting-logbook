/** Classification of a lift by primary training role. */
export type LiftClassification = 'compound' | 'accessory';

/**
 * Movement pattern tags used to classify a lift.
 * Tags combine to describe a pattern — e.g., push + vertical = overhead press pattern.
 */
export type MovementTag = 'push' | 'pull' | 'vertical' | 'horizontal' | 'hinge' | 'carry' | 'squat';

/** A first-class exercise domain object. */
export interface Lift {
  id: string;
  name: string;
  classification: LiftClassification;
  movementTags: MovementTag[];
  /** True when body weight contributes to the total load (e.g. chin-ups, dips). */
  isBodyweightComponent?: boolean;
}

/**
 * A named lift. Typed as a branded string so new lifts can be added without
 * a code change, while still enabling autocomplete from LIFT_NAMES.
 */
export type LiftName = string & {};

/** Canonical set of known lifts, used for validation and autocomplete. */
export const LIFT_NAMES = [
  // 5/3/1 big four
  'Squat',
  'Bench Press',
  'Deadlift',
  'Overhead Press',
  // RPT primary
  'Barbell Row',
  'Chin-up',
  // RPT accessory
  'Cable Curls',
  'Calf Raise',
  'Dips',
  // Balance / lagging body parts
  'Face Pulls',
  'Cable Lat Raise',
  'Upright Row',
] as const satisfies LiftName[];

/** Unit of measurement for weights. */
export type WeightUnit = 'lbs' | 'kg';

/** A single body weight observation recorded at session start. */
export interface BodyWeightEntry {
  date: Date;
  weight: number;
  unit: WeightUnit;
}

/** Week number within a training cycle (1-based, 4-week cycles). */
export type WeekNumber = 1 | 2 | 3 | 4;

/**
 * Cycle number within a training program.
 * 1-indexed: the first cycle is cycle 1.
 */
export type CycleNumber = number;
