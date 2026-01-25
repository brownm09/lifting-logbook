import { CycleDashboardRepository } from "@src/api/repositories";
import { runWithErrorHandling } from "@src/api/ui";

export class NavigationAction {
  /**
   * Route: Logic for cleaning/formatting
   */
  run(sheetName: string) {
    runWithErrorHandling(() => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found.`);
      }
      sheet.activate();
    });
  }
}

export class NavToCurrentWorkoutAction {
  run() {
    runWithErrorHandling(() => {
      const repo = new CycleDashboardRepository();
      const dashboard = repo.getCycleDashboard();
      const sheetName = dashboard.sheetName;
      try {
        new NavigationAction().run(sheetName);
      } catch (e) {
        throw new Error(
          `Failed to navigate to Current Workout sheet "${sheetName}": ${e}`,
        );
      }
    });
  }
}
