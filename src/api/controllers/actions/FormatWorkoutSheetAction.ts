import { runWithErrorHandling, WorkoutRepository, WorkoutView } from "@src/api";

// For formatting workout sheets
export class FormatWorkoutSheetAction {
  run() {
    runWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSheet();
      // check if it's a workout sheet by checking the sheet name pattern (date)
      const sheetName = sheet.getName();
      if (!/\d+_\d{4}\d{2}\d{2}$/.test(sheetName)) {
        throw new Error(
          `Sheet "${sheetName}" does not appear to be a workout sheet.`,
        );
      }
      const workoutRepository: WorkoutRepository = new WorkoutRepository(
        sheetName,
      );
      const data = workoutRepository.getWorkout();
      WorkoutView.formatWorkoutSheet(data, sheet);
      const toastMsg = `Workout sheet "${sheet.getName()}" formatted successfully.`;
      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
    });
  }
}
