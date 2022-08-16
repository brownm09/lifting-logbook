/**
 *  Delete blank rows and columns from sheet
 *
 *  @param {SpreadsheetApp.Sheet} sheet
 *
 */
 function cropSheet(sheet) {
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
  
  /**
   *  Delete all rows and columns from sheet
   *
   *  @param {SpreadsheetApp.Sheet} sheet
   *
   */
  function emptySheet(sheet) {
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    const maxCols = sheet.getMaxColumns();
    const maxRows = sheet.getMaxRows();
    if (maxCols > 1) {
      sheet.deleteColumns(2, maxCols - 1);
    }
    if (maxRows > 1) {
      sheet.deleteRows(2, maxRows - 1);
    }
    sheet.getRange("A1").clear();
  }
  
  /**
   *  Creates a TOC of sheets as formula based hyperlinks
   *
   */
  function cropAllSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      cropSheet(sheets[i]);
    }
  }