import { MSG_ERROR_SHEET_NOT_FOUND } from "@src/api/constants/constants";

export class WorkoutRepository {
  private sheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor(sheetName: string) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(MSG_ERROR_SHEET_NOT_FOUND(sheetName));
    this.sheet = sheet;
  }

  /**
   * Hides the workout sheet from the user
   */
  public hideSheet(): void {
    this.sheet.hideSheet();
  }

  /**
   * Hides the row
   * @param row The 0-based index of the row to hide
   */
  public hideRows(rowsToHide: number[]): void {
    const sortedRows = [...rowsToHide].sort((a, b) => a - b);
    this.sheet.hideRows(sortedRows[0] + 1, sortedRows.length);
  }

  /**
   * Fetches workout data including header row
   * @return 2D array of workout data
   */
  public getWorkout(): any[][] {
    const data = this.sheet.getDataRange().getDisplayValues();
    // Keep header row
    return data;
  }

  /**
   * Writes the Workout data back to the sheet
   * @param data The workout data including header row
   */
  public setWorkout(data: any[][]): void {
    // Write starting at row 1 to include header
    this.sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }
}
