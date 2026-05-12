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
