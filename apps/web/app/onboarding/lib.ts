export type DiscoveryMethod = 'estimate' | 'test' | 'manual';

export type LiftKey = 'bench' | 'squat' | 'deadlift';

export type LiftEntry = { weight: string; reps: string };

export const LIFT_LABELS: Record<LiftKey, string> = {
  bench: 'Bench Press',
  squat: 'Back Squat',
  deadlift: 'Deadlift',
};

export function brzycki1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  const denom = 37 - reps;
  if (denom <= 0) return 0;
  return Math.round((weight * 36) / denom);
}
