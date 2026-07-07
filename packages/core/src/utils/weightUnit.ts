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
 * Converts a weight for display, rounded to 2 decimal places. Display-only —
 * the result must never be persisted or fed back into a comparison; the
 * stored value stays in its original unit at full precision (see
 * docs/standards/training-max-precision.md).
 */
export function formatWeight(
  weight: number,
  from: WeightUnit,
  to: WeightUnit,
): string {
  const converted = convertWeight(weight, from, to);
  const rounded = Math.round(converted * 100) / 100;
  return `${rounded} ${to}`;
}
