import type { StrengthStandard } from '@lifting-logbook/types';

export const DEFAULT_STRENGTH_STANDARDS: readonly StrengthStandard[] = [
  { liftId: 'back-squat',      tier: 'intermediate', multiplier: 1.6 },
  { liftId: 'back-squat',      tier: 'advanced',     multiplier: 2.0 },
  { liftId: 'back-squat',      tier: 'elite',        multiplier: 2.4 },
  { liftId: 'bench-press',     tier: 'intermediate', multiplier: 1.2 },
  { liftId: 'bench-press',     tier: 'advanced',     multiplier: 1.5 },
  { liftId: 'bench-press',     tier: 'elite',        multiplier: 1.8 },
  { liftId: 'chin-up',         tier: 'intermediate', multiplier: 1.2 },
  { liftId: 'chin-up',         tier: 'advanced',     multiplier: 1.5 },
  { liftId: 'chin-up',         tier: 'elite',        multiplier: 1.8 },
  { liftId: 'deadlift',        tier: 'intermediate', multiplier: 2.0 },
  { liftId: 'deadlift',        tier: 'advanced',     multiplier: 2.5 },
  { liftId: 'deadlift',        tier: 'elite',        multiplier: 3.0 },
  { liftId: 'overhead-press',  tier: 'intermediate', multiplier: 0.75 },
  { liftId: 'overhead-press',  tier: 'advanced',     multiplier: 1.0 },
  { liftId: 'overhead-press',  tier: 'elite',        multiplier: 1.25 },
];

export function evaluateStrengthTier(
  trainingMax: number,
  bodyweight: number,
  multiplier: number,
): { achieved: boolean; progressRatio: number } {
  const threshold = bodyweight * multiplier;
  return {
    achieved: trainingMax >= threshold,
    progressRatio: threshold > 0 ? trainingMax / threshold : 0,
  };
}
