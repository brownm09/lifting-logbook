import { TrainingMax } from "@src/core/models";
import { mapTrainingMaxes, parseTrainingMaxes } from "@src/core/utils";

export class TrainingMaxRepository {
  private sheet;
  constructor() {
    this.sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TRAINING_MAXES");
    if (!this.sheet) {
      throw new Error("TRAINING_MAXES sheet not found");
    }
  }

  /**
   * Fetches and maps all rows to the CycleDashboard model
   */
  public getTrainingMaxes(): TrainingMax[] {
    const data = this.sheet.getDataRange().getDisplayValues();
    // console.log(`Fetched training maxes data: ${JSON.stringify(data)}.`);
    return parseTrainingMaxes(data);
  }

  /**
   * Writes the TrainingMaxes data back to the sheet
   */
  public setTrainingMaxes(trainingMaxes: TrainingMax[]): void {
    const data = mapTrainingMaxes(trainingMaxes);
    // Write starting at row 2 to preserve header
    this.sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    // Trim extra rows and columns
  }
}
