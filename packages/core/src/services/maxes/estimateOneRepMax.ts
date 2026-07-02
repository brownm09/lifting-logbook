import { floorToIncrement } from "@src/core/constants";

// Brzycki formula (1993) JOPERD 64(1):88-90; valid for reps 1-36 (asymptote beyond that).
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return floorToIncrement(weight);
  const denom = 37 - reps;
  if (denom <= 0) return 0;
  return floorToIncrement((weight * 36) / denom);
}
