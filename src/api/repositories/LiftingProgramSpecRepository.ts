import {
  MSG_ERROR_SHEET_NOT_FOUND,
  SHEET_NAME_PROGRAM_SPEC,
} from "@src/api/constants/constants";
import { cropSheet } from "@src/api/ui";
import { LiftingProgramSpec } from "@src/core/models";
import {
  mapLiftingProgramSpec,
  parseLiftingProgramSpec,
} from "@src/core/utils";

export class LiftingProgramSpecRepository {
  private sheet: GoogleAppsScript.Spreadsheet.Sheet;

  constructor() {
    this.sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      SHEET_NAME_PROGRAM_SPEC,
    );
    if (!this.sheet) {
      throw new Error(MSG_ERROR_SHEET_NOT_FOUND(SHEET_NAME_PROGRAM_SPEC));
    }
  }

  /**
   * Fetches and maps all rows to the RptProgramSpec model
   */
  public getLiftingProgramSpec(): LiftingProgramSpec[] {
    const data = this.sheet.getDataRange().getValues();
    // Remove header row
    // data.shift();
    return parseLiftingProgramSpec(data);
  }

  /**
   * Writes the RptProgramSpec data back to the sheet
   */
  public setLiftingProgramSpec(liftingProgramSpec: LiftingProgramSpec[]): void {
    const data = mapLiftingProgramSpec(liftingProgramSpec);
    // Write starting at row 2 to preserve header
    this.sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    // Trim extra rows and columns
    cropSheet(this.sheet);
  }
}
