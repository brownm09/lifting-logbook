/**
 * Creates a lift plan from a training max and program spec.
 * @param {TrainingMax} tm
 * @param {RptProgramSpec} ps
 * @param {Date} startDate
 * @return {any[]}
 */

export function generateLiftPlan(tm, ps, startDate) {
  let workoutGrid: any[][] = [];
  const LIFT_DATE_HEADER = "Lift Date";
  const WARMUP_BASE_REPS = 5;
  const progSpecLiftName = ps.lift;
  const progSpecNumSets = ps.sets;
  const progSpecIncrement = ps.increment;
  const progSpecWtDec = ps.wtDecrementPct;
  // Warm-up percentages
  const progSpecWarmPcts = `${ps.warmUpPct}`
    .split(",")
    .map((pct) => parseFloat(pct));
  // Work set percentages
  const progSpecWorkPcts = Array(progSpecNumSets)
    .fill(1)
    .reduce((acc, num) => {
      acc.push(num - acc.length * progSpecWtDec);
      return acc;
    }, [] as number[]);
  for (let k = 0; k < progSpecWarmPcts.length; k++) {
    workoutGrid.push([
      `=INDEX(A1:F, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("${LIFT_DATE_HEADER}", A2:2, 0))`,
      progSpecLiftName,
      `Warm-up ${k + 1}`,
      `=MROUND(PRODUCT(INDEX(A1:D, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("TM", A2:2, 0)), ${progSpecWarmPcts[k]}), ${progSpecIncrement})`,
      WARMUP_BASE_REPS - k,
      "",
    ]);
  }
  for (let k = 0; k < progSpecWorkPcts.length; k++) {
    workoutGrid.push([
      `=INDEX(A1:F, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("${LIFT_DATE_HEADER}", A2:2, 0))`,
      progSpecLiftName,
      `Set ${k + 1}`,
      `=MROUND(PRODUCT(INDEX(A1:D, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("TM", A2:2, 0)), ${progSpecWorkPcts[k]}), ${progSpecIncrement})`,
      "",
      "",
    ]);
  }
  return workoutGrid;
}
