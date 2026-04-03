export class SheetRepository {
  private ss: GoogleAppsScript.Spreadsheet.Spreadsheet;

  constructor() {
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * Safely creates a new sheet with headers and formatting.
   * If the sheet exists, it returns the existing sheet.
   */
  public createTableSheet(
    name: string,
    data: any[][],
  ): GoogleAppsScript.Spreadsheet.Sheet {
    let sheet = this.ss.getSheetByName(name);

    if (sheet) {
      // Option A: Just return it
      return sheet;
      // Option B: Clear it and start fresh (uncomment if needed)
      // sheet.clear();
    }

    // 1. Create the sheet and insert data
    sheet = this.ss.insertSheet(name);
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    return sheet;
  }
}
