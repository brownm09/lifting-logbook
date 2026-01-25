import { runWithErrorHandling, WorkoutRepository, WorkoutView } from "@src/api";
import {
  MSG_ERROR_NOT_WORKOUT_SHEET,
  MSG_SUCCESS_TOAST_WORKOUT,
} from "@src/api/constants/constants";

// For formatting workout sheets
export class FormatWorkoutSheetAction {
  run() {
    runWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSheet();
      // check if it's a workout sheet by checking the sheet name pattern (date)
      const sheetName = sheet.getName();
      if (!/\d+_\d{4}\d{2}\d{2}$/.test(sheetName)) {
        throw new Error(MSG_ERROR_NOT_WORKOUT_SHEET(sheetName));
      }
      const workoutRepository: WorkoutRepository = new WorkoutRepository(
        sheetName,
      );
      const data = workoutRepository.getWorkout();
      WorkoutView.formatWorkoutSheet(data, sheet);
      const toastMsg = MSG_SUCCESS_TOAST_WORKOUT(sheet.getName());
      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
    });
  }
}
