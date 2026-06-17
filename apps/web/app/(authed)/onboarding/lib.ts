export type DiscoveryMethod = 'estimate' | 'test' | 'manual' | 'tm';

/**
 * Methods that capture a single weight per lift with no reps: `manual` (an
 * entered 1RM) and `tm` (an entered training max). The estimate/test methods
 * capture a full weight × reps set. Centralized so the no-reps taxonomy lives
 * in one place as the method union grows (e.g. a future CSV-import method) —
 * the parent flow and the entry step must agree on which methods skip reps.
 */
export function isWeightOnly(method: DiscoveryMethod): boolean {
  return method === 'manual' || method === 'tm';
}

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
