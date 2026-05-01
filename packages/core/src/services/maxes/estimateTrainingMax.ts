// Brzycki formula (1993) JOPERD 64(1):88-90; valid for reps 1-36 (asymptote beyond that).
export function estimateTrainingMax(weight: number, reps: number): number {
  if (reps < 1 || reps > 36) {
    throw new RangeError(`reps must be between 1 and 36, got ${reps}`);
  }
  const oneRepMax = weight / (1.0278 - 0.0278 * reps);
  return Math.round(oneRepMax / 5) * 5;
}
