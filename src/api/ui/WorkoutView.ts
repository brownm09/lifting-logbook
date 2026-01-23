import { cropSheet } from "../utils";

export class WorkoutView {
  /**
   * Formats the workout sheet for better UX
   * @param {any[][]} data The workout data including header row
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to format
   */
  public static formatWorkoutSheet(
    data: any[][],
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
  ): void {
    // const workoutRepo = new WorkoutRepository(sheetName);
    data.findIndex((row) => row[0] === "Date"); // Ensure data is present
    // Find all indices of header rows (any row containing "Lift" in any column)
    const headerRowIndices: number[] = [];
    let notesHeaderRow: number = -1;
    let notesHeaderCol: number = -1;
    data.forEach((row, idx) => {
      if (
        row.findIndex(
          (cell: any) => cell && cell.toString().includes("Lift"),
        ) !== -1
      ) {
        headerRowIndices.push(idx);
        if (row.includes("Notes")) {
          notesHeaderRow = idx;
          notesHeaderCol = row.indexOf("Notes");
        }
      }
    });
    // Apply header formatting to each header row
    headerRowIndices.forEach((rowIdx) => {
      WorkoutView.headerifyRow(sheet, rowIdx + 1);
    });
    // Freeze the first two rows (main headers)
    sheet.setFrozenRows(2);
    // Auto resize columns to fit content
    sheet.autoResizeColumns(1, data[0].length);
    cropSheet(sheet);
    // Highlight today's rows based on date in column 1
    WorkoutView.highlightTodayRows(sheet, 1);
    // Center align all cells
    sheet
      .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
      .setHorizontalAlignment("center");

    // Left align the Notes column if found
    if (notesHeaderRow !== -1 && notesHeaderCol !== -1) {
      sheet
        .getRange(
          notesHeaderRow + 2,
          notesHeaderCol + 1,
          sheet.getLastRow() - notesHeaderRow - 1,
          1,
        )
        .setHorizontalAlignment("left");
    }
  }

  /**
   * Adds conditional formatting: if the date column matches today, highlight the row.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to format
   * @param {number} rowIdx The 1-based index of the row to format
   */
  public static headerifyRow(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    rowIdx: number = 1,
  ): void {
    sheet
      .getRange(rowIdx, 1, 1, sheet.getLastColumn())
      .setHorizontalAlignment("center")
      .setFontWeight("bold");
  }

  /**
   * Adds conditional formatting: if the date column matches today, highlight the row.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to format
   * @param {number} dateCol The 1-based index of the date column (e.g., 2 for column B)
   */
  public static highlightTodayRows(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    dateCol: number = 1,
  ): void {
    const rules = sheet.getConditionalFormatRules();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return; // No data to format

    // Google Sheets default highlight color (light yellow)
    const highlightColor = "#1e7d3c";

    // Format: highlight entire row if date in dateCol equals today
    const formula = `=$${String.fromCharCode(64 + dateCol)}2=TODAY()`;

    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(highlightColor)
      .setRanges([sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn())])
      .build();

    // Remove previous similar rules (optional, or just add)
    rules.push(rule);
    sheet.setConditionalFormatRules(rules);
  }
}
