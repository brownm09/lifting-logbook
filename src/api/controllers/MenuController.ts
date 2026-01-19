import {
  createGridV2,
  extractLiftRecords,
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

      const dashboard = dashboardRepo.getCycleDashboard();
      const programSpec = programRepo.getLiftingProgramSpec();
      const trainingMaxes = trainingMaxRepo.getTrainingMaxes();
      const liftRecordRepo = new LiftRecordRepository();

      const workoutRepo = new WorkoutRepository(dashboard.sheetName);
      const workoutData = workoutRepo.getWorkout();
      const newLiftRecords = extractLiftRecords(workoutData);

      const newCycle = updateCycle(dashboard);
      const newTrainingMaxes = updateMaxes(
        programSpec,
        trainingMaxes,
        newLiftRecords,
      );
      const newWorkout = createGridV2(
        programSpec,
        newTrainingMaxes,
        newCycle.cycleStartDate,
      );

      liftRecordRepo.appendLiftRecords(newLiftRecords);
      trainingMaxRepo.setTrainingMaxes(newTrainingMaxes);

      const newWorkoutSheet = sheetRepository.createTableSheet(
        newCycle.sheetName,
        newWorkout,
      );

      dashboardRepo.setCycleDashboard(newCycle);

      const toastMsg =
        `New cycle sheet "${newCycle.sheetName}" created.` +
        `\nSuccessfully recorded ${newLiftRecords.length} lift records.` +
        `\nTraining maxes updated.` +
        `\nDashboard updated.`;

      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
      SpreadsheetApp.setActiveSheet(newWorkoutSheet);
      workoutRepo.hideSheet();
    });
  }

  /**
   * Route: Logic for cleaning/formatting
   */
  static handleFormatSheet() {
    runWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSheet();
      // You could call a utility here
      sheet.autoResizeColumns(1, sheet.getLastColumn());
      cropSheet(sheet);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Sheet "${sheet.getName()}" formatted successfully.`,
        "Success",
      );
    });
  }
}
