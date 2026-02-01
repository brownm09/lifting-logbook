import {
  addDaysUTC,
  LIFT_SPEC_HEADERS,
  LiftingProgramSpec,
  TrainingMax,
} from "@src/core";

/**
 * Creates a lift specification from a training max and program spec.
 * @param {TrainingMax} tm
 * @param {RptProgramSpec} ps
 * @param {Date} startDate
 * @return {any[]}
 */

export function generateLiftSpec(
  tm: TrainingMax,
  ps: LiftingProgramSpec,
  startDate,
) {
  // console.log(`Offset for ${ps.lift}: ${ps.offset}`);
  let liftDate = addDaysUTC(startDate, ps.offset);
  // console.log(`Original start date: ${formatDateYYYYMMDD(startDate)}; offset date: ${formatDateYYYYMMDD(liftDate)}`);

  // Build a mapping from header to value
  const specMap: Record<string, any> = {
    "Core Lift": ps.lift,
    Scheme: `${ps.sets} × ${ps.reps}`,
    "Inc. Amt.": ps.increment,
    TM: tm.weight,
    "Lift Date": liftDate,
    "Activ. Ex.": ps.activation,
  };

  // Return values in the order of LIFT_SPEC_HEADERS
  return LIFT_SPEC_HEADERS.map((header) => specMap[header]);
}
