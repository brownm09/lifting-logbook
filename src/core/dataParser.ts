import { RptProgramSpec } from "./RptProgramSpec";

/**
 * Converts a 2D array to an array of RptProgramSpec objects.
 * @param {any[][]} data
 * @returns {RptProgramSpec[]}
 */
function parseRptProgramSpec(data: any[][]): RptProgramSpec[] {
  const headerMap: Record<string, { key: string; type: string }> = {
    Offset: { key: "offset", type: "number" },
    Lift: { key: "lift", type: "string" },
    Increment: { key: "increment", type: "number" },
    Order: { key: "order", type: "number" },
    Sets: { key: "sets", type: "number" },
    Reps: { key: "reps", type: "number" },
    "AMRAP?": { key: "amrap", type: "boolean|string" },
    "Warm-Up %": { key: "warmUpPct", type: "string" },
    "WT Decrement %": { key: "wtDecrementPct", type: "number" },
    Activation: { key: "activation", type: "string" },
  };
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
function tableToObjects<T = Record<string, any>>(
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
import { formatDateYYYYMMDD } from "./jsUtil";

function parseTrainingMaxes(data: any[][]): TrainingMax[] {
  const headerMap: Record<string, { key: string; type: string }> = {
    "Date Updated": { key: "dateUpdated", type: "string" },
    Lift: { key: "lift", type: "string" },
    Weight: { key: "weight", type: "number" },
  };
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

import { TrainingMax } from "./TrainingMax";

export { parseRptProgramSpec, parseTrainingMaxes, tableToObjects };
