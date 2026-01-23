import {
  createGridV2,
  CycleDashboard,
  extractLiftRecords,
  LiftingProgramSpec,
  LiftRecord,
  TrainingMax,
  updateCycle,
  updateMaxes,
} from "../../core";
import {
  CycleDashboardRepository,
  LiftingProgramSpecRepository,
  LiftRecordRepository,
  SheetRepository,
  TrainingMaxRepository,
  WorkoutRepository,
} from "../repositories";
import { runWithErrorHandling } from "../ui";
import { WorkoutView } from "../ui/WorkoutView";
import { cropSheet } from "../utils";

export class MenuController {
  /**
   * Creates the custom menu in the Spreadsheet UI
   */
  static createMenu() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("Logbook Tools")
      // .addItem("Start New Year", "handleAnnualCutover") // currently a stub
      // .addSeparator()
      .addItem("Format Current Sheet", "handleFormatSheet")
      .addItem("Format Current Workout Sheet", "handleFormatWorkoutSheet")
      .addSeparator()
      .addItem("Start New Cycle", "startNewCycle")
      .addToUi();
  }

  /**
   * Route: Logic for starting a new cycle in the lifting program
   */
  static startNewCycle() {
    runWithErrorHandling(() => {
      const sheetRepository = new SheetRepository();
      const dashboardRepo = new CycleDashboardRepository();
      const programRepo = new LiftingProgramSpecRepository();
      const trainingMaxRepo = new TrainingMaxRepository();

      const dashboard: CycleDashboard = dashboardRepo.getCycleDashboard();
      const programSpec: LiftingProgramSpec[] =
        programRepo.getLiftingProgramSpec();
      const trainingMaxes: TrainingMax[] = trainingMaxRepo.getTrainingMaxes();
      const liftRecordRepo = new LiftRecordRepository();

      const workoutRepo = new WorkoutRepository(dashboard.sheetName);
      const workoutData = workoutRepo.getWorkout();
      const newLiftRecords: LiftRecord[] = extractLiftRecords(workoutData);

      const newCycle: CycleDashboard = updateCycle(dashboard);
      console.log(`New cycle generated: ${JSON.stringify(newCycle)}.`);
      const newTrainingMaxes = updateMaxes(
        programSpec,
        trainingMaxes,
        newLiftRecords,
      );
      const newWorkout = createGridV2(
        programSpec,
        newTrainingMaxes,
        newCycle.cycleDate,
      );

      liftRecordRepo.appendLiftRecords(newLiftRecords);
      trainingMaxRepo.setTrainingMaxes(newTrainingMaxes);

      const newWorkoutSheet = sheetRepository.createTableSheet(
        newCycle.sheetName,
        newWorkout,
      );
      // const newWorkoutRepo = new WorkoutRepository(newCycle.sheetName);
      dashboardRepo.setCycleDashboard(newCycle);

      const toastMsg =
        `New cycle sheet "${newCycle.sheetName}" created.` +
        `\nSuccessfully recorded ${newLiftRecords.length} lift records.` +
        `\nTraining maxes updated.` +
        `\nDashboard updated.`;

      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
      SpreadsheetApp.setActiveSheet(newWorkoutSheet);
      WorkoutView.formatWorkoutSheet(newWorkout, newWorkoutSheet);
      workoutRepo.hideSheet();
    });
  }

  /**
   * Route: Logic for cleaning/formatting
   */
  static handleFormatSheet() {
    runWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSheet();
      sheet.autoResizeColumns(1, sheet.getLastColumn());
      cropSheet(sheet);
      const toastMsg = `Sheet "${sheet.getName()}" formatted successfully.`;
      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
    });
  }

  // For formatting workout sheets
  static handleFormatWorkoutSheet() {
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
