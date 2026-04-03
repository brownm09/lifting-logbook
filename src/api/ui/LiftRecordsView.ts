import { cropSheet } from "@src/api/ui";

export class LiftRecordsView {
  /**
   * Formats the lift records sheet for better UX
   * @param {any[][]} data The lift records data including header row
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to format
   */
  public static formatLiftRecordsSheet(
    data: any[][],
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
  ): void {
    // const workoutRepo = new WorkoutRepository(sheetName);
    const dateHeaderIdx = data[0].indexOf("Date");
    const notesHeaderIdx = data[0].indexOf("Notes");
    if (dateHeaderIdx === -1) {
      throw new Error("Date column not found in workout data.");
    }
    if (notesHeaderIdx === -1) {
      throw new Error("Notes column not found in workout data.");
    }
    // Only apply striped rows if not already present
    const rules = sheet.getConditionalFormatRules();
    const hasStripeRule = rules.some((rule) => {
      try {
        // Check for ISEVEN(ROW()) formula in the rule
        const formula =
          rule.getBooleanCondition &&
          rule.getBooleanCondition()?.getCriteriaValues?.()[0];
        return (
          typeof formula === "string" &&
          formula.replace(/\s/g, "").toUpperCase() === "=ISEVEN(ROW())"
        );
      } catch {
        return false;
      }
    });
    if (!hasStripeRule) {
      LiftRecordsView.stripeRows(sheet);
    }
    // Freeze the first two rows (main headers)
    sheet.setFrozenRows(1);
    // Auto resize columns to fit content
    sheet.autoResizeColumns(1, data[0].length);
    cropSheet(sheet);
    // Center align all cells
    sheet
      .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
      .setHorizontalAlignment("center");

    // Left align the Notes column if found
    if (notesHeaderIdx !== -1) {
      sheet
        .getRange(2, notesHeaderIdx + 1, sheet.getLastRow(), 1)
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
  public static stripeRows(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
    // const rules = sheet.getConditionalFormatRules();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return; // No data to format

    // Striped row color (very light gray)
    const stripeColor = "#f5f5f5";

    // Striped rows: apply to even rows (starting from row 2)
    const stripeFormula = "=ISEVEN(ROW())";
    const stripeRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(stripeFormula)
      .setBackground(stripeColor)
      .setRanges([sheet.getRange(2, 1, lastRow, sheet.getLastColumn())])
      .build();

    // Add both rules (order: highlight first, then stripes)
    // rules.push(stripeRule);
    sheet.setConditionalFormatRules([stripeRule]);
  }
}
