/**
 * Normalizes an AMRAP value to a boolean.
 * Handles both parsed booleans and string values from CSV parsing.
 */
export function normalizeAmrap(value: unknown): boolean {
  return value === true || value === 'TRUE';
}
