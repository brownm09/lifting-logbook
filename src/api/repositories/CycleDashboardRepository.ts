import {
  CycleDashboard,
  mapCycleDashboard,
  parseCycleDashboard,
} from "../../core";
import { cropSheet } from "../utils/cropSheet";

export class CycleDashboardRepository {
  private sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DASHBOARD");

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
      const link = `=HYPERLINK("${url}#gid=${workoutSheetId}", "${cycleDashboard.sheetName}")`;
      cycleDashboard.sheetName = link;
    }

    const data = mapCycleDashboard(cycleDashboard);
    // Write starting at row 2 to preserve header
    this.sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    // Trim extra rows and columns
    cropSheet(this.sheet);
  }
}
