import { LiftingProgramSpec, TrainingMax } from "../../models";
import { addDaysUTC } from "../../utils/jsUtil";

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
  return [
    ps.lift,
    `${ps.sets} × ${ps.reps}`,
    tm.weight,
    ps.increment,
    liftDate,
    ps.activation,
  ];
}
