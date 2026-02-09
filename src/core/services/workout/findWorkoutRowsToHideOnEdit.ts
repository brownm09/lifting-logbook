import { findRepsHeaderCoordinates } from "./findRepsHeaderCoordinates";

/**
 * Given the sheet data, reps header coordinates, and the edited row,
 * returns the rows to hide when a working set's reps cell is edited.
 * Hides the working set row and any warm-up rows for the same lift above it.
 *
 * @param workoutData 2D array of sheet values
 * @param editedRow number (1-based) of the edited row
 * @param editedCol number (1-based) of the edited column
 * @returns array of 1-based row numbers to hide
 */
export function findWorkoutRowsToHideOnEdit(
  workoutData: any[][],
  editedRow: number,
  editedCol: number,
): number[] {
  const rowsToHide: number[] = [];
  // Find coordinates of "Reps" header
  const repsCoord = findRepsHeaderCoordinates(workoutData);
  const repsRow = repsCoord.row;
  const repsCol = repsCoord.col;

  // If edited column is not the "Reps" column, return empty array
  if (editedCol !== repsCol) return [];
  // If edited row is above reps header, return empty array
  if (editedRow <= repsRow) return [];

  // Find column indices for "Set" and "Lift" in the reps header row
  const SET_COL = workoutData[repsRow].indexOf("Set");
  const LIFT_COL = workoutData[repsRow].indexOf("Lift");
  const currLift = workoutData[editedRow][LIFT_COL];

  for (let r = editedRow; r > repsRow; r--) {
    if (workoutData[r][LIFT_COL] === currLift) {
      // workoutRepo.hideRow(r + 1);
      rowsToHide.push(r);
    }
    // if (allValues[r][SET_TYPE_COL] === "Warm-up") ;
  }
  return rowsToHide;
}
