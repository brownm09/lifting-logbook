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

/**
 * Determine if two ranges intersect.
 * @param {SpreadsheetApp.Range} range1
 * @param {SpreadsheetApp.Range} range2
 */
function doesRangeIntersect(range1, range2) {
  var lastRow1 = range1.getLastRow();
  var row2 = range2.getRow();
  if (lastRow1 < row2) return false;
  
  var lastRow2 = range2.getLastRow();
  var row1 = range1.getRow();
  if (lastRow2 < row1) return false;
  
  var lastCol1 = range1.getLastColumn();
  var col2 = range2.getColumn();
  if (lastCol1 < col2) return false;
  
  var lastCol2 = range2.getLastColumn();
  var col1 = range1.getColumn();
  if (lastCol2 < col1) return false;

  return true;
}
