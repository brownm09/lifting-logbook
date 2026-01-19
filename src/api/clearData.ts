import { DATE_FORMAT_REGEX, MAIN_LIFT_NAMES } from "./constants";
import { getLiftNamedRange, getRangeName } from "./namedRanges";

/**
 * Clear data, but preserve conditional formatting of modifiable fields.
 * @param {SpreadsheetApp.Sheet} sheet
 */
function clearDates(sheet) {
  var textFinder = sheet.createTextFinder(DATE_FORMAT_REGEX);
  textFinder.useRegularExpression(true);
  textFinder.matchFormulaText(false);
  textFinder.matchEntireCell(true);
  // textFinder.findAll().forEach(match => {
  // Logger.log(`Match located: ${match.getA1Notation()}: ${match.getValue()}`);
  // match.clearContent();
  // });
  textFinder.replaceAllWith("");
}

/**
 * Clear entered data from range
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {SpreadsheetApp.Range} range
 */
function clearEntries(sheet, range) {
  // Find "Set 3" row in range (can find dynamically, but it's usually fourth row in range)
  var cellR = range
    .createTextFinder("Set 3")
    .matchEntireCell(true)
    .matchCase(true)
    .findNext();
  var editableRow = cellR.getRow();
  var cellC = range
    .createTextFinder("Warm-Up")
    .matchEntireCell(true)
    .matchCase(true)
    .findNext();
  var editableCol = cellC.getColumn();
  var rowCount = range.getLastRow() - editableRow;
  var colCount = range.getLastColumn() - editableCol;
  // console.log(`Row: ${editableRow}`);
  // console.log(`Col: ${editableCol}`);
  // console.log(`End-R: ${range.getLastRow()}`);
  // console.log(`End-C: ${range.getLastColumn()}`);
  var editableRange = sheet.getRange(
    editableRow + 1,
    editableCol + 1,
    rowCount,
    colCount,
  );
  console.log(`Editable range: ${editableRange.getA1Notation()}`);
  for (var i = 1; i <= rowCount; i++) {
    for (var j = 1; j <= colCount; j++) {
      var cell = editableRange.getCell(i, j);
      if (cell.getDataValidation() == null && cell.getFormula() == "") {
        // console.log(`Cell ${cell.getA1Notation()} is safe to clear.`);
        cell.clearContent();
      }
    }
  }
}

/**
 * Clear entered data from all editable ranges
 * @param {SpreadsheetApp.Sheet} sheet
 */
function clearAllEntries(sheet) {
  const sheetName = sheet.getSheetName();
  MAIN_LIFT_NAMES.forEach((liftName) => {
    var rangeName = getRangeName(sheetName, liftName);
    var namedRange = getLiftNamedRange(sheetName, liftName);
    var targetRange = namedRange.getRange();
    Logger.log(
      `Result of getLiftNamedRange(${sheetName},${liftName}): ${namedRange}`,
    );
    if (namedRange === undefined) {
      Logger.log(
        `No named range found for ${rangeName}; could not clear entries.`,
      );
    } else {
      Logger.log(`Clearing entries for range ${targetRange.getA1Notation()}.`);
      clearEntries(sheet, targetRange);
    }
  });
}

export { clearAllEntries, clearDates, clearEntries };
