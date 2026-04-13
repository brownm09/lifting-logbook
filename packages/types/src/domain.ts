/** Union of supported core lifts. */
export type LiftName = 'Squat' | 'Bench Press' | 'Deadlift' | 'Overhead Press';

/** Unit of measurement for weights. */
export type WeightUnit = 'lbs' | 'kg';

/** Week number within a training cycle (1-based, 4-week cycles). */
export type WeekNumber = 1 | 2 | 3 | 4;

/**
 * Cycle number within a training program.
 * 1-indexed: the first cycle is cycle 1.
 */
export type CycleNumber = number;
