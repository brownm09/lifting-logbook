export type DiscoveryMethod = 'estimate' | 'test' | 'manual' | 'tm';

/** A single lift the user is entering a max for during onboarding. */
export type LiftRow = { lift: string; weight: string; reps: string };

/**
 * Lifts seeded into the "Enter Lifts" step for a zero-config user. These are
 * canonical catalog names (see LIFT_NAMES in @lifting-logbook/types) so the
 * entered maxes map directly to valid lifts when persisted. Note: the squat
 * row uses the catalog name 'Squat' (previously displayed as 'Back Squat').
 */
export const DEFAULT_LIFTS = ['Bench Press', 'Squat', 'Deadlift'] as const;

export function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  const denom = 37 - reps;
  if (denom <= 0) return 0;
  return Math.round((weight * 36) / denom);
}
