import {
  FORMULA_HYPERLINK_SHEET,
  SHEET_NAME_DASHBOARD,
} from "@src/api/constants/constants";
import { CycleDashboard } from "@src/core/models";
import { mapCycleDashboard, parseCycleDashboard } from "@src/core/utils";

export class CycleDashboardRepository {
  private sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_DASHBOARD);

  /**
   * Fetches and maps all rows to the CycleDashboard model
   * Retrieves display values to handle hyperlinks properly
   * @return CycleDashboard object
   */
  public getCycleDashboard(): CycleDashboard {
    const data = this.sheet.getDataRange().getDisplayValues();
    // Remove header row
    data.shift();
    return parseCycleDashboard(data);
  }

  /**
   * Writes the CycleDashboard data back to the sheet
   * If sheetName is present, converts it to a hyperlink formula
   * @param cycleDashboard The CycleDashboard object to write
   */
  public setCycleDashboard(cycleDashboard: CycleDashboard): void {
    if (cycleDashboard.sheetName && cycleDashboard.sheetName !== "") {
      const url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
      const workoutSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
        cycleDashboard.sheetName,
      );
      const workoutSheetId = workoutSheet ? workoutSheet.getSheetId() : null;
      const link = FORMULA_HYPERLINK_SHEET(
        url,
        workoutSheetId,
        cycleDashboard.sheetName,
      );
      cycleDashboard.sheetName = link;
    }

    const data = mapCycleDashboard(cycleDashboard);
    // Write starting at row 1 as mapCycleDashboard includes header
    this.sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }
}
