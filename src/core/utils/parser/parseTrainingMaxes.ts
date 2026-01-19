import { TRAINING_MAX_HEADER_MAP } from "../../constants/schema";
import { TrainingMax } from "../../models/TrainingMax";
import { formatDateYYYYMMDD } from "../jsUtil";
import { tableToObjects } from "./tableToObjects";

/**
 * Example: parseTrainingMaxes(sheet.getDataRange().getValues())
 * @param {any[][]} data
 * @returns {TrainingMax[]}
 */

export function parseTrainingMaxes(data: any[][]): TrainingMax[] {
  const headerMap = TRAINING_MAX_HEADER_MAP;
  const rawObjects = tableToObjects(data, undefined);
  return rawObjects.map((obj) => {
    const result: any = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header];
      let value = obj[header];
      if (type === "number") {
        value = Number(value);
      }
      if (key === "dateUpdated") {
        value = formatDateYYYYMMDD(value);
      }
      result[key] = value;
    }
    return result as TrainingMax;
  });
}
