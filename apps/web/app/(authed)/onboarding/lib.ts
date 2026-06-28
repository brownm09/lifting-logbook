export type DiscoveryMethod = 'estimate' | 'test' | 'manual' | 'tm' | 'import';

/**
 * Methods that capture a single weight per lift with no reps: `manual` (an
 * entered 1RM), `tm` (an entered training max), and `import` (training maxes
 * loaded from a CSV). The estimate/test methods capture a full weight × reps
 * set. Centralized so the no-reps taxonomy lives in one place — the parent flow
 * (advance gate) and the entry steps must agree on which methods skip reps.
 * `import` never renders StepLifts, but the advance gate still uses this to
 * require only a weight per row once the file has pre-filled them.
 */
export function isWeightOnly(method: DiscoveryMethod): boolean {
  return method === 'manual' || method === 'tm' || method === 'import';
}

/**
 * Methods whose entered/imported weight *is* the training max and is persisted
 * as-is, with no 90%-of-1RM derivation: `tm` (typed directly) and `import`
 * (loaded from a training-maxes CSV). `estimate`/`test`/`manual` instead yield
 * a 1RM from which the training max is derived at 90%. Distinct from
 * {@link isWeightOnly}: `manual` is weight-only but is a 1RM, not a training max.
 */
export function valuesAreTrainingMax(method: DiscoveryMethod): boolean {
  return method === 'tm' || method === 'import';
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

/**
 * Derives the ordered, deduplicated lift list for a program from its
 * PRESET_BASE_SPECS entry and returns ready-to-use LiftRow seeds.
 * Returns an empty array when the program has no spec (graceful fallback for
 * unmapped programs — the lifts panel stays empty and the user adds manually).
 */
export function getSeedLifts(
  spec: ReadonlyArray<{ lift: string }> | undefined,
): LiftRow[] {
  if (!spec || spec.length === 0) return [];
  return [...new Set(spec.map((row) => row.lift))].map((lift) => ({
    lift,
    weight: '',
    reps: '',
  }));
}

export function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  const denom = 37 - reps;
  if (denom <= 0) return 0;
  return Math.round((weight * 36) / denom);
}
