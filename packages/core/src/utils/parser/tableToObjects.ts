import { SpreadsheetCell } from "@src/core";

/**
 * Converts a 2D array (as from Sheet.getDataRange().getValues() or parsed CSV) to an array of objects using the first row as headers.
 * @param {SpreadsheetCell[][]} data - 2D array with first row as headers
 * @returns {Record<string, SpreadsheetCell | undefined>[]}
 */

export function tableToObjects<T = Record<string, SpreadsheetCell | undefined>>(
  data: SpreadsheetCell[][],
  headerMap?: Record<string, string>,
): T[] {
  if (!data || data.length < 2) return [];
  const headers = data[0]!.map((h) => String(h));
  // console.log(`Headers: ${JSON.stringify(headers)}`);
  return data.slice(1).map((row) => {
    const obj: Record<string, SpreadsheetCell | undefined> = {};
    headers.forEach((header, i) => {
      const key = headerMap && headerMap[header] ? headerMap[header] : header;
      obj[key] = row[i];
    });
    return obj as T;
  });
}
