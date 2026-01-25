import { SHEET_NAME_LIFT_RECORDS } from "@src/api/constants/constants";
import { cropSheet } from "@src/api/ui";
import { LiftRecord } from "@src/core/models";
import { mapLiftRecords, parseLiftRecords } from "@src/core/utils";
export class LiftRecordRepository {
  private sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAME_LIFT_RECORDS,
  );

  /**
   * Fetches and maps all rows to the LiftRecord model
   */
  public getLiftRecords(): LiftRecord[] {
    const data = this.sheet.getDataRange().getValues();
    // Remove header row
    // data.shift();
    return parseLiftRecords(data);
  }

  /**
   * Writes the LiftRecords data back to the sheet
   */
  public appendLiftRecords(liftRecords: LiftRecord[]): void {
    const data = mapLiftRecords(liftRecords);
    const lastRow = this.sheet.getLastRow();
    const lastCol = this.sheet.getLastColumn();
    this.sheet
      .getRange(lastRow + 1, 1, data.length - 1, data[0].length)
      .setValues(data.slice(1)); // Skip header row
    cropSheet(this.sheet);
  }
}
