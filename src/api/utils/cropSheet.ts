/**
 *  Delete blank rows and columns from sheet
 *
 *  @param {SpreadsheetApp.Sheet} sheet
 *
 */
export function cropSheet(sheet) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const maxCols = sheet.getMaxColumns();
  const maxRows = sheet.getMaxRows();
  if (maxCols > lastCol) {
    sheet.deleteColumns(lastCol + 1, maxCols - lastCol);
  }
  if (maxRows > lastRow) {
    sheet.deleteRows(lastRow + 1, maxRows - lastRow);
  }
}
