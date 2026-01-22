import { mapTrainingMaxes, parseTrainingMaxes, TrainingMax } from "../../core";
import { cropSheet } from "../utils/cropSheet";

export class TrainingMaxRepository {
  private sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TRAINING_MAXES");

  /**
   * Fetches and maps all rows to the CycleDashboard model
   */
  public getTrainingMaxes(): TrainingMax[] {
    const data = this.sheet.getDataRange().getDisplayValues();
    console.log(`Fetched training maxes data: ${JSON.stringify(data)}.`);
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
    cropSheet(this.sheet);
  }
}
