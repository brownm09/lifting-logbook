import {
  LIFT_DATE_HEADER,
  PROG_SPEC_WARMUP_PCTS,
  PROG_SPEC_WORK_PCTS,
  WARMUP_BASE_REPS,
} from "@src/core/constants";
import { LiftingProgramSpec, TrainingMax } from "@src/core/models";

/**
 * Creates a lift plan from a training max and program spec.
 * @param {TrainingMax} tm
 * @param {LiftingProgramSpec} ps
 * @param {Date} startDate
 * @return {any[]}
 */

export function generateLiftPlan(
  tm: TrainingMax,
  ps: LiftingProgramSpec,
  _startDate: Date,
) {
  const workoutGrid: any[][] = [];
  const progSpecLiftName = ps.lift;
  const progSpecNumSets = ps.sets;
  const progSpecIncrement = ps.increment;
  const progSpecWtDec = ps.wtDecrementPct;
  // Warm-up percentages
  const progSpecWarmPcts = PROG_SPEC_WARMUP_PCTS(ps.warmUpPct);
  // Work set percentages
  const progSpecWorkPcts = PROG_SPEC_WORK_PCTS(progSpecNumSets, progSpecWtDec);

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
