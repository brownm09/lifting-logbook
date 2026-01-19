import { LiftRecord, mapLiftRecords, parseLiftRecords } from "../../core";
import { cropSheet } from "../utils/cropSheet";

export class LiftRecordRepository {
  private sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LIFT_RECORDS");

  /**
   * Fetches and maps all rows to the LiftRecord model
   */
  public getLiftRecords(): LiftRecord[] {
    const data = this.sheet.getDataRange().getValues();
    // Remove header row
    data.shift();
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
      .getRange(lastRow + 1, 1, data.length, data[0].length)
      .setValues(data);
    cropSheet(this.sheet);
  }
}
