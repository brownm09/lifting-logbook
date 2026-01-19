import { cropSheet } from "../utils/cropSheet";

export class WorkoutRepository {
  private sheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor(sheetName: string) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    this.sheet = ss.getSheetByName(sheetName);
    if (!this.sheet) throw new Error(`Sheet ${sheetName} not found`);
  }

  /**
   * Hides the workout sheet from the user
   */
  public hideSheet(): void {
    this.sheet.hideSheet();
  }

  /**
   * Fetches workout data including header row
   * @return 2D array of workout data
   */
  public getWorkout(): any[][] {
    const data = this.sheet.getDataRange().getValues();
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
    // Trim extra rows and columns
    cropSheet(this.sheet);
  }
}
