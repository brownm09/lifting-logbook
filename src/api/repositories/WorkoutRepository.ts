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
    this.addTodayHighlightConditionalFormat();
    // Trim extra rows and columns
    cropSheet(this.sheet);
  }

  /**
   * Adds conditional formatting: if the date column matches today, highlight the row.
   * @param dateCol The 1-based index of the date column (e.g., 2 for column B)
   */
  public addTodayHighlightConditionalFormat(dateCol: number = 1): void {
    const rules = this.sheet.getConditionalFormatRules();
    const lastRow = this.sheet.getLastRow();
    if (lastRow < 2) return; // No data to format

    // Google Sheets default highlight color (light yellow)
    const highlightColor = "#1e7d3c";

    // Format: highlight entire row if date in dateCol equals today
    const formula = `=$${String.fromCharCode(64 + dateCol)}2=TODAY()`;

    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(highlightColor)
      .setRanges([
        this.sheet.getRange(2, 1, lastRow - 1, this.sheet.getLastColumn()),
      ])
      .build();

    // Remove previous similar rules (optional, or just add)
    rules.push(rule);
    this.sheet.setConditionalFormatRules(rules);
  }
}
