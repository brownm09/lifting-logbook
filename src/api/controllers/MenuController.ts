export class MenuController {
  /**
   * Creates the custom menu in the Spreadsheet UI
   */
  static createToolsMenu() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("Logbook Tools")
      // .addItem("Start New Year", "handleAnnualCutover") // currently a stub
      // .addSeparator()
      .addItem("Format Current Sheet", "handleFormatSheet")
      .addItem("Format Current Workout Sheet", "handleFormatWorkoutSheet")
      .addSeparator()
      .addItem("Update Training Maxes", "handleUpdateTrainingMaxes")
      // .addItem("Refresh Workout Grid", "handleRefreshWorkoutGrid")
      .addSeparator()
      .addItem("Start New Cycle", "startNewCycle")
      .addToUi();
  }

  /**
   * Creates the navigation menu in the Spreadsheet UI
   */
  static createNavMenu() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("Logbook Navigation")
      .addItem("Cycle Dashboard", "handleNavToDashboard")
      .addItem("Training Maxes", "handleNavToMaxes")
      .addItem("Program Spec", "handleNavToProgramSpec")
      .addItem("Current Workout", "handleNavToCurrentWorkout")
      .addToUi();
  }
}
