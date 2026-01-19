import {
  COL_HIDE_RANGE,
  CURRENT_LIFT_INDEX,
  CURRENT_WEEK_INDEX,
  DATE_FORMAT_REGEX,
  MAIN_LIFT_NAMES,
  SECTION_HIDE_START_KEY,
  WARMUP_COL_INDEX,
} from "./constants";
import { getLiftNamedRange } from "./namedRanges";
import { flatten } from "./util";

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
export function updateView(sheet) {
  var currWeekRange = sheet.getRange(CURRENT_WEEK_INDEX);
  var currLiftRange = sheet.getRange(CURRENT_LIFT_INDEX);
  currWeekRange.setValue("1");
  currLiftRange.setValue("Squat");
  updateColView(sheet, "1");
  updateLiftView(sheet, "Squat");
}

/**
 * Hide and unhide columns based on the current week selected.
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {String} colNum The column to view
 */
export function updateColView(sheet, colNum) {
  var colHideRange = sheet.getRange(COL_HIDE_RANGE);
  var colUnhideRange = sheet.getRange(1, parseInt(colNum) + WARMUP_COL_INDEX);
  sheet.hideColumn(colHideRange);
  sheet.unhideColumn(colUnhideRange);
}

/**
 * Hide and unhide sections based on the current date and current lift.
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {String} liftName The section to view
 */
export function updateLiftView(sheet, liftName) {
  var rowHeaders = flatten(sheet.getRange("A1:A").getValues());
  var rangeStart = rowHeaders.indexOf(SECTION_HIDE_START_KEY) + 1;
  var hideRangeA1Notation = `A${rangeStart}:A`;
  var hideRange = sheet.getRange(hideRangeA1Notation);
  sheet.hideRow(hideRange);
  var namedRange = getLiftNamedRange(sheet.getName(), liftName);
  Logger.log(namedRange);
  sheet.unhideRow(namedRange.getRange());
}

/**
 * Hide columns for which dates have been filled all the way down
 * @param {SpreadsheetApp.Sheet} sheet
 */
export function hideFilledColumns(sheet) {
  const WEEK_SUMMARY_REGEX = "Week [0-9]";
  var textFinder = sheet.createTextFinder(WEEK_SUMMARY_REGEX);
  textFinder.useRegularExpression(true);
  textFinder.matchFormulaText(false);

  var weekHeaders = textFinder.findAll();
  weekHeaders.forEach((week) => {
    var weekColNum = week.getColumn();
    var weekCol = sheet.getRange(1, weekColNum, sheet.getLastRow(), 1);
    var dateTextFinder = weekCol.createTextFinder(DATE_FORMAT_REGEX);
    dateTextFinder.useRegularExpression(true);
    dateTextFinder.matchFormulaText(false);
    dateTextFinder.matchEntireCell(true);
    if (dateTextFinder.findAll().length == MAIN_LIFT_NAMES.length) {
      Logger.log(`Hiding column ${weekColNum}`);
      sheet.hideColumn(weekCol);
    } else {
      Logger.log(
        `Column ${weekColNum} only has ${dateTextFinder.findAll().length} dates in it; ${MAIN_LIFT_NAMES.length} dates needed.`,
      );
    }
  });
}
