import {
  CORE_LIFT_HEADER,
  LIFT_DATE_HEADER,
  LiftingProgramSpec,
} from "@src/core";

/**
 * Updates lift dates for lifts with the same offset as the edited lift.
 * @param data 2D array of workout sheet values.
 * @param programSpec Program specification object.
 * @param editedCellRow Row index of the edited cell.
 * @returns Updated 2D array with lift dates synchronized.
 */
export function updateLiftDates(
  data: any[][],
  programSpecs: LiftingProgramSpec[],
  editedCellRow: number,
  // editedCellCol: number,
): any[][] {
  const workoutMetaHeaderRowIdx = data.findIndex((row) =>
    row.includes(LIFT_DATE_HEADER),
  );
  const workoutMetaHeaderRow = data[workoutMetaHeaderRowIdx];
  const coreLiftIdx = workoutMetaHeaderRow.indexOf(CORE_LIFT_HEADER);
  const liftDateIdx = workoutMetaHeaderRow.indexOf(LIFT_DATE_HEADER);
  const editedLiftData = data[editedCellRow];
  const editedLiftName = editedLiftData[coreLiftIdx];
  const editedLiftDate = editedLiftData[liftDateIdx];
  const editedOffset = programSpecs.find(
    (spec) => spec.lift === editedLiftName,
  )?.offset;
  console.log(
    `Edited lift: ${editedLiftName}, Date: ${editedLiftDate}, Offset: ${editedOffset}.`,
  );

  const otherLiftsWithSameOffset = programSpecs
    .filter(
      (spec) => spec.offset === editedOffset && spec.lift !== editedLiftName,
    )
    ?.map((spec) => spec.lift);

  console.log(
    `Other lifts with same offset (${editedOffset}): ${otherLiftsWithSameOffset}.`,
  );

  otherLiftsWithSameOffset.forEach((liftName) => {
    let rowIdx = data.findIndex((row) => row[coreLiftIdx] === liftName);
    console.log(
      `Updating lift ${liftName} at row ${rowIdx} from ${data[rowIdx][liftDateIdx]} to date ${editedLiftDate}.`,
    );
    data[rowIdx][liftDateIdx] = new Date(editedLiftDate);
    // // Find the row for this lift and update its date
    // for (
    //   let i = workoutMetaHeaderRowIdx + 1;
    //   i < workoutMetaHeaderRowIdx + programSpecs.length;
    //   i++
    // ) {
    //   if (data[i][coreLiftIdx] === liftName) {
    //     data[i][liftDateIdx] = editedLiftDate;
    //     break;
    //   }
    // }
  });
  return data;
}
