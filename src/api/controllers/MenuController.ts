import {
  MENU_NAME_APP,
  MENU_NAME_NAVIGATION,
} from "@src/api/constants/constants";
export class MenuController {
  /**
   * Creates the custom menu in the Spreadsheet UI
   */
  static createToolsMenu() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu(MENU_NAME_APP)
      // .addItem("Start New Year", "handleAnnualCutover") // currently a stub
      // .addSeparator()
      .addItem("Format Current Sheet", "handleFormatSheet")
      .addItem("Format Current Workout Sheet", "handleFormatWorkoutSheet")
      .addSeparator()
      .addItem("Update Training Maxes", "handleUpdateTrainingMaxes")
      // .addItem("Refresh Workout Grid", "handleRefreshWorkoutGrid")
      .addSeparator()
      .addItem("Start New Cycle", "startNewCycle")
      .addSeparator()
      .addItem("Cycle Dashboard", "handleNavToDashboard")
      .addItem("Training Maxes", "handleNavToMaxes")
      .addItem("Program Spec", "handleNavToProgramSpec")
      .addItem("Lift Records", "handleNavToLiftRecords")
      .addItem("Current Workout", "handleNavToCurrentWorkout")
      .addToUi();
  }

  /**
   * Creates the navigation menu in the Spreadsheet UI
   */
  static createNavMenu() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu(MENU_NAME_NAVIGATION) // Consider making this a constant if reused
      .addItem("Cycle Dashboard", "handleNavToDashboard")
      .addItem("Training Maxes", "handleNavToMaxes")
      .addItem("Program Spec", "handleNavToProgramSpec")
      .addItem("Lift Records", "handleNavToLiftRecords")
      .addItem("Current Workout", "handleNavToCurrentWorkout")
      .addToUi();
  }
}
