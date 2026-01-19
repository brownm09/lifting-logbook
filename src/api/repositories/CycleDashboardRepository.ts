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
   */
  public getCycleDashboard(): CycleDashboard {
    const data = this.sheet.getDataRange().getValues();
    // Remove header row
    data.shift();
    return parseCycleDashboard(data);
  }

  /**
   * Writes the CycleDashboard data back to the sheet
   */
  public setCycleDashboard(cycleDashboard: CycleDashboard): void {
    const data = mapCycleDashboard(cycleDashboard);
    // Write starting at row 2 to preserve header
    this.sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    // Trim extra rows and columns
    cropSheet(this.sheet);
  }
}
