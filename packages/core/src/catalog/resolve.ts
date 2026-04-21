import { Lift } from '@lifting-logbook/types';

/**
 * Resolves a slot name to a Lift from the catalog.
 *
 * @param slotName  - The exercise slot name (e.g., the `lift` field from LiftingProgramSpec).
 * @param slotMap   - A mapping from slot name → catalog Lift id.
 * @param catalog   - The Lift catalog to search.
 * @returns The matching Lift.
 * @throws  If the slot name is not in slotMap or the resolved id is not in the catalog.
 */
export function resolveLift(
  slotName: string,
  slotMap: Readonly<Record<string, string>>,
  catalog: readonly Lift[],
): Lift {
  const liftId = slotMap[slotName];
  if (liftId === undefined) {
    throw new Error(`Unknown exercise slot: "${slotName}". Add it to the slot map.`);
  }
  const lift = catalog.find((l) => l.id === liftId);
  if (!lift) {
    throw new Error(`Lift id "${liftId}" not found in catalog.`);
  }
  return lift;
}
