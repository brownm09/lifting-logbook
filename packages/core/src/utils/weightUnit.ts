import { WeightUnit } from "@lifting-logbook/types";

// Exact international pound (1 lb = 0.45359237 kg, defined). Used instead of
// an approximate reciprocal so lbs->kg->lbs round-trips don't drift.
const KG_PER_LB = 0.45359237;

/** Converts a weight between lbs and kg at full precision (no rounding). */
export function convertWeight(
  weight: number,
  from: WeightUnit,
  to: WeightUnit,
): number {
  if (from === to) return weight;
  return from === "lbs" ? weight * KG_PER_LB : weight / KG_PER_LB;
}

/**
 * Rounds a *converted* weight to 2 decimal places for display. Only apply this
 * to a value produced by an lbs<->kg conversion — a conversion introduces
 * irrational-looking trailing digits that must be trimmed for display. Never
 * apply it to a directly-known value being shown in its own unit; those must
 * display at full precision (see docs/standards/training-max-precision.md).
 */
export function roundToDisplay(weight: number): number {
  return Math.round(weight * 100) / 100;
}

/**
 * Formats a weight for display in the target unit. When `from === to` the value
 * is a directly-known weight shown in its own unit and is rendered at full
 * precision (no rounding) per docs/standards/training-max-precision.md category
 * 1 — e.g. a 316.875 lbs training max (0.625 increment) stays "316.875 lbs".
 * Only a genuine cross-unit conversion is rounded to 2 dp for display.
 */
export function formatWeight(
  weight: number,
  from: WeightUnit,
  to: WeightUnit,
): string {
  if (from === to) return `${weight} ${to}`;
  return `${roundToDisplay(convertWeight(weight, from, to))} ${to}`;
}
