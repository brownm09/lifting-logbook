/**
 * Returns the stringified natural key for a lift record:
 * `"<cycleNum>:<workoutNum>:<lift>:<setNum>"`
 *
 * The natural key uniquely identifies a set within a (userId, program) scope.
 * It mirrors the `@@unique` constraint in the Prisma schema:
 * `(userId, program, cycleNum, workoutNum, lift, setNum)`.
 * `userId` and `program` are omitted here because callers always operate within
 * a single user/program context.
 *
 * Example: `liftRecordNaturalKey({ cycleNum: 3, workoutNum: 2, lift: 'bench-press', setNum: 1 })`
 * returns `"3:2:bench-press:1"`.
 */
export function liftRecordNaturalKey(r: {
  cycleNum: number;
  workoutNum: number;
  lift: string;
  setNum: number;
}): string {
  return `${r.cycleNum}:${r.workoutNum}:${r.lift}:${r.setNum}`;
}

/**
 * Inverse of {@link liftRecordNaturalKey}. Returns null for malformed keys.
 *
 * The lift field may contain colons (e.g. "chin-up"), so only the first two
 * and the last segment are numeric; everything in between is the lift name.
 */
export function parseLiftRecordNaturalKey(
  key: string,
): { cycleNum: number; workoutNum: number; lift: string; setNum: number } | null {
  const parts = key.split(':');
  if (parts.length < 4) return null;
  const cycleNum = parseInt(parts[0] ?? '', 10);
  const workoutNum = parseInt(parts[1] ?? '', 10);
  const setNum = parseInt(parts[parts.length - 1] ?? '', 10);
  const lift = parts.slice(2, parts.length - 1).join(':');
  if (isNaN(cycleNum) || isNaN(workoutNum) || isNaN(setNum) || !lift) return null;
  return { cycleNum, workoutNum, lift, setNum };
}
