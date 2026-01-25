import { cropSheet } from "@src/api/ui";
import { LiftingProgramSpec } from "@src/core/models";
import {
  mapLiftingProgramSpec,
  parseLiftingProgramSpec,
} from "@src/core/utils";

export class LiftingProgramSpecRepository {
  private sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RPT_PROGRAM_SPEC");

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
