import type { Lift } from '@lifting-logbook/types';

export function calculateAddedWeight(
  targetLoad: number,
  bodyWeight: number,
): number {
  return targetLoad - bodyWeight;
}

export function getBodyweightComponentLifts(catalog: readonly Lift[]): Lift[] {
  return catalog.filter((l) => l.isBodyweightComponent === true);
}
