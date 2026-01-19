import { SET_REP_SCHEME_REGEX } from "./constants";

/**
 * Formats a sheet with bold headers, row banding, and auto-resize.
 * @param {SpreadsheetApp.Sheet} sheet
 */
export function formatSheet(sheet) {
  var colHeaders = sheet
    .getRange(1, 1, 2, sheet.getLastColumn())
    .setFontWeight("bold");
  var rowHeaders = sheet
    .getRange(1, 1, sheet.getLastRow(), 1)
    .setFontWeight("bold");
  var fullGrid = sheet
    .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
    .setHorizontalAlignment("center")
    .applyRowBanding();
  sheet
    .createTextFinder(SET_REP_SCHEME_REGEX)
    .useRegularExpression(true)
    .findAll()
    .forEach((setRepRange) => {
      sheet
        .getRange(setRepRange.getRow(), 1, 1, sheet.getLastColumn())
        .setFontWeight("bold");
    });
  sheet.autoResizeColumns(1, sheet.getLastColumn());
}

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

/**
 *  Delete all rows and columns from sheet
 *
 *  @param {SpreadsheetApp.Sheet} sheet
 *
 */
export function emptySheet(sheet) {
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
export function cropAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    cropSheet(sheets[i]);
  }
}

export function highlightTodayRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  // Define the range you want to apply formatting to (e.g., A2 to Z1000)
  const range = sheet.getRange("A2:Z" + sheet.getLastRow());

  // Clear existing conditional format rules to avoid duplicates
  const rules = sheet.getConditionalFormatRules();

  // Custom formula: $A2 refers to the first cell in the range (absolute column, relative row)
  // TODAY() is a Sheets function that returns the current date
  const formula = "=$A2=TODAY()";

  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula)
    .setBackground("#b7e1cd") // Light green hex code
    .setRanges([range])
    .build();

  rules.push(rule);
  sheet.setConditionalFormatRules(rules);
}

/**
 * Creates a custom menu when the spreadsheet opens.
 */
export function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Sheet Tools")
    .addItem("Unhide All Rows", "unhideAllRows")
    .addToUi();
}

/**
 * Monitors edits in Column E.
 * If Column D is "Set 1", it hides all "Warm-up" rows
 * sharing the same Column B and Date.
 */
export function hideRowOnEntry(e) {
  Logger.log("hideRowOnEntry()");
  const range = e.range;
  const sheet = range.getSheet();
  const row = range.getRow();
  const col = range.getColumn();

  // 1. Trigger only if Column E (5) is edited
  if (col === 5 && row > 1 && e.value !== undefined) {
    const rowValues = sheet.getRange(row, 1, 1, 4).getValues()[0];
    const liftDate = rowValues[0]; // Column A
    const lifeName = rowValues[1]; // Column B
    const setName = rowValues[2]; // Column C

    // 2. Setup Today's Date comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday =
      liftDate instanceof Date &&
      new Date(liftDate).setHours(0, 0, 0, 0) === today.getTime();

    // 3. Check if the triggering row in Column D is exactly "Set 1"
    if (isToday && setName === "Set 1") {
      const allData = sheet.getDataRange().getValues();
      const warmUpRegex = /^Warm-up \d+/;

      // 4. Iterate through the sheet to find Warm-up rows to hide
      for (let i = 0; i < allData.length; i++) {
        const currentRowDate = allData[i][0];
        const currentRowB = allData[i][1];
        const currentRowD = allData[i][3];

        const isMatchDate =
          currentRowDate instanceof Date &&
          new Date(currentRowDate).setHours(0, 0, 0, 0) === today.getTime();

        // Condition: Same Date, Same Column B, and Column D starts with "Warm-up"
        if (
          isMatchDate &&
          currentRowB === lifeName &&
          warmUpRegex.test(currentRowD)
        ) {
          sheet.hideRows(i + 1);
        }
      }
    }
  }
}

/**
 * Utility function to reveal all hidden rows.
 */
export function unhideAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    sheet.showRows(1, lastRow);
  }
}
