/**
 * Extract row of values from sheet, specified by index.
 * @param {SpreadsheetApp.Sheet} sheet The source sheet.
 * @param {number} rowIndex The target row index (starts at 1).
 * @return {Object[]} The row values as a flattened array
 */
function getRowByIndex(sheet, rowIndex) {
  var lastCol = sheet.getLastColumn();
  return sheet.getRange(1, rowIndex, 1, lastCol).getValues()[0];
}

/**
 * Extract column of values from sheet, specified by index.
 * @param {SpreadsheetApp.Sheet} sheet The source sheet.
 * @param {number} colIndex The target column index (starts at 1).
 * @return {Object[]} The column values as a flattened array
 */
function getColByIndex(sheet, colIndex) {
  var lastRow = sheet.getLastRow();
  var column = sheet.getRange(1, colIndex, lastRow, 1);
  return column.getValues().flat();
}

/**
 * Flatten a two-dimensional array.
 * @param {[]} arr The array to flatten.
 * @return [] The flattened array
 */
function flatten(arr) {
  return arr.reduce((acc, val) => acc.concat(val), []);
}
