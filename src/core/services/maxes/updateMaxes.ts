import { formatDateYYYYMMDD, LiftingProgramSpec } from "../..";
import { LiftRecord } from "../../models/LiftRecord";
import { TrainingMax } from "../../models/TrainingMax";
/**
 * Updates training maxes based on lift records and program spec.
 * For any lift record:
 *  - If set number is 1,
 *  - reps for set 1 > reps specified in program spec for the lift,
 *  - lift date is after the training max date for the lift,
 * Then set the training max weight to set 1's weight + increment from program spec.
 * Update the training max date to the lift date.
 * @param trainingMaxes - Array of current training maxes
 * @param liftRecords - Array of lift records
 * @param programSpec - Program specifications including reps and increments
 */
export function updateMaxes(
  programSpec: LiftingProgramSpec[],
  trainingMaxes: TrainingMax[],
  liftRecords: LiftRecord[],
): TrainingMax[] {
  // Clone the training maxes to avoid mutating input
  let newMaxes: TrainingMax[] = trainingMaxes.map((tm) => ({ ...tm }));
  console.log(`New maxes initialized: ${JSON.stringify(newMaxes)}.`);

  liftRecords.forEach((record) => {
    const liftName = record.lift;
    const tmIndex = newMaxes.findIndex((tm) => tm.lift === liftName);
    if (record.setNum !== 1) {
      console.log(
        `Skipping lift record for ${liftName} set ${record.setNum} (not set 1).`,
      );
      return;
    }
    console.log(`Processing lift record for ${liftName} set 1.`);
    if (tmIndex === -1)
      throw new Error(`Training max for lift ${liftName} not found.`);

    const spec = programSpec.find((ps) => ps.lift === liftName);
    if (!spec) throw new Error(`Program spec for lift ${liftName} not found.`);

    console.log(
      `Current training max for ${liftName}: weight=${newMaxes[tmIndex].weight}, date=${newMaxes[tmIndex].dateUpdated}`,
    );
    console.log(
      `Program spec for ${liftName}: reps=${spec.reps}, increment=${spec.increment}`,
    );
    console.log(
      `Lift record for ${liftName}: reps=${record.reps}, date=${record.date}, weight=${record.weight}`,
    );

    // Check reps and date conditions
    if (
      record.reps >= spec.reps &&
      new Date(record.date).getTime() >
        new Date(newMaxes[tmIndex].dateUpdated).getTime()
    ) {
      // Update training max
      newMaxes[tmIndex].weight = record.weight + spec.increment;
      newMaxes[tmIndex].dateUpdated = formatDateYYYYMMDD(record.date);
    }
  });

  return newMaxes;
}
