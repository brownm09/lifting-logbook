import {
  MSG_ERROR_NAV_TO_WORKOUT,
  MSG_ERROR_SHEET_NOT_FOUND,
} from "@src/api/constants/constants";
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
        throw new Error(MSG_ERROR_SHEET_NOT_FOUND(sheetName));
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
          MSG_ERROR_NAV_TO_WORKOUT(dashboard.sheetName, e.message),
        );
      }
    });
  }
}
