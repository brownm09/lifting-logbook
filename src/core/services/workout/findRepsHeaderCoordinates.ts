/**
 * Finds the coordinates of the first cell containing "Reps" in a 2D array.
 * Returns 1-based row and column indices.
 * @param data 2D array representing the sheet values
 * @param sheetName Optional, for error messages
 */
export function findRepsHeaderCoordinates(
  data: any[][],
  sheetName?: string,
): { row: number; col: number } {
  const row = data.findIndex((r) => r.includes("Reps"));
  if (row === -1)
    throw new Error(
      `"Reps" column not found${sheetName ? ` in sheet ${sheetName}` : ""}`,
    );
  const col = data[row].indexOf("Reps");
  if (col === -1)
    throw new Error(
      `"Reps" column not found${sheetName ? ` in sheet ${sheetName}` : ""}`,
    );
  return { row: row, col: col }; // Retain 0-based index
}
