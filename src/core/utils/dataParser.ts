import {
  LIFT_RECORD_HEADER_MAP,
  RPT_PROGRAM_SPEC_HEADER_MAP,
  TRAINING_MAX_HEADER_MAP,
} from "../constants/schema";
import { LiftRecord } from "../models/LiftRecord";
import { RptProgramSpec } from "../models/RptProgramSpec";
import { TrainingMax } from "../models/TrainingMax";
import { formatDateYYYYMMDD } from "./jsUtil";

/**
 * Converts a 2D array to an array of LiftRecord objects.
 * @param {any[][]} data
 * @returns {LiftRecord[]}
 */
export function parseLiftRecords(data: any[][]): LiftRecord[] {
  const headerMap = LIFT_RECORD_HEADER_MAP;
  const rawObjects = tableToObjects(data, undefined);
  return rawObjects.map((obj) => {
    const result: any = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header];
      let value = obj[header];
      if (type === "number") {
        value = Number(value);
      }
      result[key] = value;
    }
    return result as LiftRecord;
  });
}

/**
 * Converts a 2D array to an array of RptProgramSpec objects.
 * @param {any[][]} data
 * @returns {RptProgramSpec[]}
 */
export function parseRptProgramSpec(data: any[][]): RptProgramSpec[] {
  // Use header map from constants
  const headerMap = RPT_PROGRAM_SPEC_HEADER_MAP;
  // Convert using tableToObjects, then cast/convert types
  const rawObjects = tableToObjects(data, undefined);
  return rawObjects.map((obj) => {
    const result: any = {};
    for (const header in headerMap) {
      const { key, type } = headerMap[header];
      let value = obj[header];
      if (type === "number") {
        value = Number(value);
      } else if (type === "boolean|string") {
        if (value === "TRUE" || value === true) value = true;
        else if (value === "FALSE" || value === false) value = false;
        // else leave as string
      }
      result[key] = value;
    }
    return result as RptProgramSpec;
  });
}
/**
 * Converts a 2D array (as from Sheet.getDataRange().getValues() or parsed CSV) to an array of objects using the first row as headers.
 * @param {any[][]} data - 2D array with first row as headers
 * @returns {Record<string, any>[]}
 */
export function tableToObjects<T = Record<string, any>>(
  data: any[][],
  headerMap?: Record<string, string>,
): T[] {
  if (!data || data.length < 2) return [];
  const headers = data[0].map((h: any) => String(h));
  return data.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((header, i) => {
      const key = headerMap && headerMap[header] ? headerMap[header] : header;
      obj[key] = row[i];
    });
    return obj as T;
  });
}

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
