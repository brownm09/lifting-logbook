/**
 * Estimates a training max from a recent performance using the Brzycki formula.
 * Valid rep range: 1–36 (formula asymptotes beyond that point).
 * Result is rounded to the nearest 5 lbs.
 *
 * Reference: Brzycki, M. (1993). Strength Testing — Predicting a One-Rep Max
 * from Reps-to-Fatigue. JOPERD 64(1):88–90.
 */
export function estimateTrainingMax(weight: number, reps: number): number {
  if (reps < 1 || reps > 36) {
    throw new RangeError(`reps must be between 1 and 36, got ${reps}`);
  }
  const oneRepMax = weight / (1.0278 - 0.0278 * reps);
  return Math.round(oneRepMax / 5) * 5;
}
