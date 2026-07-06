import type { LiftingProgramSpecResponse } from '@lifting-logbook/types';

/**
 * Resolve the numeric-input `step` for each training-max row.
 *
 * The step honors the lift's per-program plate increment when the active
 * program's specs define one (e.g. Squat steps by 10, Weighted Pull-ups by
 * 2.5). A lift with no matching spec row — e.g. a stale training max carried
 * over from a previously-active program — falls back to `defaultIncrement`,
 * which the caller derives from the user's `defaultWeightIncrement` setting
 * (itself already defaulted to `DEFAULT_WEIGHT_INCREMENT` when unset).
 *
 * `step` only drives the spinner buttons; it never rounds the directly-known
 * training-max value the user typed (see docs/standards/training-max-precision.md).
 *
 * The returned map contains an entry for every lift in `lifts` so callers can
 * index it per row. Spec rows repeat per program week; the first row seen for a
 * lift wins because a lift's increment is constant across a program's weeks.
 */
export function resolveStepIncrements(
  lifts: string[],
  specs: LiftingProgramSpecResponse[],
  defaultIncrement: number,
): Record<string, number> {
  const byLift = new Map<string, number>();
  for (const spec of specs) {
    if (!byLift.has(spec.lift)) byLift.set(spec.lift, spec.increment);
  }

  const steps: Record<string, number> = {};
  for (const lift of lifts) {
    steps[lift] = byLift.get(lift) ?? defaultIncrement;
  }
  return steps;
}
