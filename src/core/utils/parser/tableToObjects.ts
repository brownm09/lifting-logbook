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
