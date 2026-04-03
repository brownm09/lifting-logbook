import { TRAINING_MAX_HEADER_MAP, TrainingMax } from "@src/core";
import { tableToObjects } from "./tableToObjects";

/**
 * Example: parseTrainingMaxes(sheet.getDataRange().getValues())
 * @param {any[][]} data
 * @returns {TrainingMax[]}
 */

export function parseTrainingMaxes(data: any[][]): TrainingMax[] {
  const headerMap = TRAINING_MAX_HEADER_MAP;
  const rawObjects = tableToObjects(data, undefined);
  // console.log(`Raw training max objects: ${JSON.stringify(rawObjects)}.`);
  return rawObjects.map((obj) => {
    const result: any = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header];
      let value = obj[header];
      if (type === "number") {
        value = Number(value);
      }
      if (key === "dateUpdated") {
        value = new Date(value);
      }
      result[key] = value;
    }
    // console.log(`Parsed training max object: ${JSON.stringify(result)}.`);
    const isDateValid =
      result.dateUpdated instanceof Date &&
      !isNaN(result.dateUpdated.getTime());
    const isWeightValid =
      typeof result.weight === "number" && !isNaN(result.weight);
    const isLiftValid =
      typeof result.lift === "string" && result.lift.length > 0;
    if (!isLiftValid) {
      throw new Error(
        `Invalid lift value: ${result.lift} (${JSON.stringify(result)})`,
      );
    }
    if (!isWeightValid) {
      throw new Error(`Invalid weight value: ${result.weight}`);
    }
    if (!isDateValid) {
      throw new Error(`Invalid dateUpdated value: ${result.dateUpdated}`);
    }
    return result as TrainingMax;
  });
}
