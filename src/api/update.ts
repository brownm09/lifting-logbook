import {
  COPIED_SHEET_PREFIX,
  CYCLE_NAME_REGEX,
  PREVIOUS_CYCLE_INDEX,
  PROG_REF_ABBRV_COL_TITLE,
  PROG_REF_SHEET_TITLE,
  RPT_NAME_REGEX,
} from "./constants";
import { getColByIndex, getRowByIndex } from "./util";

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @return {String} New program name
 */
export function updateProgram(sheet, programName) {
  // Lookup program abbreviation on other sheet and rename sheet accordingly
  var sheetName = sheet.getSheetName();
  var matches = sheetName.match(CYCLE_NAME_REGEX);
  if (matches == null) {
    Logger.log(`Unable to match versioning syntax for ${sheetName}.`);
  } else {
    var program = matches.groups.program;
    var phase = matches.groups.phase;
    var replacementProgram = getProgramAbbreviation(programName);
    sheetName = sheetName.replace(program, replacementProgram);
    sheet.setName(sheetName);
  }
  // TODO: Set program-specific row formatting (ex. PR Set, BBB Sets, etc.)
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @return {String} New program name abbreviation
 */
export function getProgramAbbreviation(programName) {
  var programRefSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROG_REF_SHEET_TITLE);
  // var sheetValues = programRefSheet.getSheetValues();
  var row = getRowByIndex(programRefSheet, 1);
  var col = getColByIndex(programRefSheet, 1);
  // return sheetValues
  //   [row.indexOf(PROG_REF_ABBRV_COL_TITLE)]
  //   [col.indexOf(programName)];
  // Logger.log(row);
  // Logger.log(col);
  return programRefSheet
    .getRange(
      col.indexOf(programName) + 1,
      row.indexOf(PROG_REF_ABBRV_COL_TITLE) + 1,
    )
    .getValue();
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @return {String} Previous sheet name
 */
export function updatePreviousSheetName(sheet) {
  var sheetName = sheet.getSheetName();
  sheetName = sheetName.replace(COPIED_SHEET_PREFIX, "");
  var previousCycleRange = sheet.getRange(PREVIOUS_CYCLE_INDEX);
  previousCycleRange.setValue(sheetName);
  // TODO: Set hyperlink
  return sheetName;
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
export function updateName(sheet) {
  // const CYCLE_MAJOR_VER_REGEX = /Cycle_[0-9]/;
  // const CYCLE_MINOR_VER_REGEX = "Cycle_([0-9])\.([0-9])\.?([0-9])?";
  var sheetName = sheet.getSheetName();
  sheetName = sheetName.replace(COPIED_SHEET_PREFIX, "");
  var matches = sheetName.match(CYCLE_NAME_REGEX);
  if (matches == null) {
    Logger.log(`Unable to match versioning syntax for ${sheetName}.`);
  } else {
    var cycleMajorNum = parseInt(matches[1]);
    var cycleMinorNum = parseInt(matches[2]);
    var scheme = sheet.getRange(1, 4).getValue();
    Logger.log(`Major cycle num: ${cycleMajorNum}`);
    Logger.log(`Minor cycle num: ${cycleMinorNum}`);
    Logger.log(`Scheme: ${scheme}`);
    if (
      (cycleMinorNum >= 5 && scheme == "2/1") ||
      (cycleMinorNum >= 7 && scheme == "3/2")
    ) {
      Logger.log(`Bumping major cycle version.`);
      // cycleMajorNum++;
      // cycleMinorNum = 0;
      sheetName.replace(
        new RegExp(`Cycle_${cycleMajorNum}\.${cycleMinorNum}`),
        `Cycle_${cycleMajorNum + 1}.0`,
      );
    } else {
      Logger.log(`Bumping minor cycle version.`);
      // cycleMinorNum++;
      sheetName = sheetName.replace(
        new RegExp(`Cycle_${cycleMajorNum}\.${cycleMinorNum}`),
        `Cycle_${cycleMajorNum}.${cycleMinorNum + 1}`,
      );
    }
    Logger.log(sheetName);
    sheet.setName(sheetName);
  }
}

/**
 * Update Estimated 1RMs after cycle completion.
 */
export function updateEstimated1Rms() {}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @return boolean
 */
export function onDiet(sheet) {
  return sheet.getRange("B4").getValue().toString() === "Yes";
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
export function updateRptNumbers(sheet) {
  // const coreLiftRange =
  const setRepSchemeRegex = "([0-9]+)\\s*×\\s*([0-9]+)";
  const dataRange = sheet.getDataRange();
  const setRepSchemes = dataRange.createTextFinder("×").findAll();
  const lastColumnIdx = sheet.getLastColumn();
  const nameColumnIdx = 1;
  // const repsOffset = 2;
  setRepSchemes.forEach((range) => {
    const matches = range.getValue().toString().match(setRepSchemeRegex);
    const sets = parseInt(matches[1]);
    const minReps = parseInt(matches[2]);

    var rowIdx = range.getRow();
    var lift = sheet.getRange(rowIdx, nameColumnIdx).getValue().toString();
    var date = sheet.getRange(rowIdx, lastColumnIdx).getValue();
    var repsOffset = -1;

    Logger.log(`Processing lift "${lift}"`);
    for (
      var tempOffset = 1;
      tempOffset + rowIdx < dataRange.getLastRow() && repsOffset === -1;
      tempOffset++
    ) {
      var firstColStr = sheet
        .getRange(rowIdx + tempOffset, nameColumnIdx)
        .getValue()
        .toString();
      if (firstColStr === "Set 1") {
        Logger.log(
          `[DEBUG] Found top set for "${lift}" (row ${rowIdx + tempOffset}).`,
        );
        repsOffset = tempOffset;
      }
      if (firstColStr === "Notes") {
        Logger.log(
          `[DEBUG] Did not find "Set 1" before reaching "Notes" for "${lift}" (row ${rowIdx + tempOffset}).`,
        );
        break;
      }
    }
    if (repsOffset === -1) {
      Logger.log(
        `[ERROR] Could not find "Set 1"; cannot update training maxes for "${lift}"`,
      );
    } else {
      const topSetWeight = parseFloat(
        sheet.getRange(rowIdx + repsOffset, lastColumnIdx - 1).getValue(),
      );
      const topSetReps = parseInt(
        sheet.getRange(rowIdx + repsOffset, lastColumnIdx).getValue(),
      );
      if (date.toString().length) {
        const entryDate = new Date(date);
        // updateRecordsRpt(entryDate, lift, topSetWeight, topSetReps);
      } else {
        Logger.log(
          `[ERROR] Could not find date; cannot record training maxes for "${lift}"`,
        );
      }
      if (topSetReps >= minReps) {
        Logger.log(
          `${lift}: Reps in top set (${topSetReps}) >= progress threshold (${minReps}). Updating...`,
        );
        updateTrainingMaxRpt(sheet, lift);
      }
    }
  });
}

/**
 * Update lift records.
 * @param {Date} date
 * @param {string} lift
 * @param {float} weight
 * @param {int} reps
 */
export function updateRecordsRpt(date, lift, weight, reps) {
  const RPT_HISTORY_SHEET_TITLE = "RPT_History";
  var historySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    RPT_HISTORY_SHEET_TITLE,
  );
  historySheet.appendRow([date, lift, weight, reps]);
}

/**
 * Update current sheet reference in TOC.
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} lift
 */
export function updateCurrSheetRef(sheet) {}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} lift
 */
export function updateTrainingMaxRpt(sheet, lift) {
  // const V_SMALL_INC_LIFTS = ["Lat Raise"];
  // const SMALL_INC_LIFTS = ["OH Press", "Bench P.", "BB Row", "Chin-up", "CBL Curls", "Dip"];
  const rangeStartRow = sheet
    .getDataRange()
    .createTextFinder("Core Lift")
    .findNext()
    .getRow();
  const rptLiftRange = sheet.getRange(
    rangeStartRow,
    1,
    rangeStartRow + 10,
    sheet.getLastColumn(),
  );
  const liftRow = rptLiftRange.createTextFinder(lift).findNext().getRow();
  const tmCol = rptLiftRange.createTextFinder("TM").findNext().getColumn();
  const bumpCol = rptLiftRange
    .createTextFinder("Inc. Amt.")
    .findNext()
    .getColumn();
  var origTmCell = sheet.getRange(liftRow, tmCol);
  var origTmVal = parseInt(origTmCell.getValue());
  var origBumpCell = sheet.getRange(liftRow, bumpCol);
  var percentBump = origTmVal * 1.025;
  // var roundAndBumpAmt = V_SMALL_INC_LIFTS.includes(lift) ? 1.25 : SMALL_INC_LIFTS.includes(lift) ? 2.5 : 5;
  var roundAndBumpAmt = parseFloat(origBumpCell.getValue());
  var absoluteBump = origTmVal + roundAndBumpAmt;
  Logger.log(
    `[${lift}] Original training max: ${origTmVal}; percent bump: ${percentBump}; absolute bump: ${absoluteBump}`,
  );
  // origTmCell.setValue(`=MROUND(${Math.min(percentBump, absoluteBump)}, ${roundAndBumpAmt})`);
  origTmCell.setValue(
    `=MROUND(${onDiet(sheet) ? absoluteBump : percentBump}, ${roundAndBumpAmt})`,
  );
}

/**
 * Clear entries from sheet
 * @param {SpreadsheetApp.Sheet} sheet
 */
export function clearRptEntries(sheet) {
  const lastCol = sheet.getLastColumn();
  const range = sheet.getRange(1, lastCol, sheet.getLastRow(), 1);
  Logger.log(`Resulting range: ${range.getA1Notation()}`);
  const numberRegex = "[0-9]+";
  range
    .createTextFinder(numberRegex)
    .matchEntireCell(true)
    .useRegularExpression(true)
    .replaceAllWith("");
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
export function incrementCycle(sheet) {
  var sheetName = sheet.getSheetName();
  sheetName = sheetName.replace(COPIED_SHEET_PREFIX, "");
  var matches = sheetName.match(RPT_NAME_REGEX);
  if (matches == null) {
    Logger.log(`Unable to match versioning syntax for ${sheetName}.`);
  } else {
    var weekNum = parseInt(matches[1]);
    var dateNum = matches[2];
    Logger.log(`Prev. week num: ${weekNum}`);
    var startDate = nextDateStr(dateNum);

    sheetName = `RPT_Week_${weekNum + 1}_${startDate}`;
    Logger.log(`New sheet name: ${sheetName}`);
    sheet.setName(sheetName);
  }
}

/**
 * Return date of following weekday as string
 * dateStr {string} date string YYYYMMDD
 * return {String}
 */
export function nextDateStr(dateStr) {
  var date = new Date(
    dateStr.substring(0, 4),
    parseInt(dateStr.substring(4, 6)) - 1,
    dateStr.substring(6, 8),
  );
  return nextDate(0, date).toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Return date of following weekday
 * dayIndex {number} day index (indexed 0 - 6, Sunday first)
 * startDate {Date} date to start calculation from, default today
 * return {Date}
 */
export function nextDate(dayIndex, startDate = new Date()) {
  var today = new Date();
  Logger.log(`Start date: ${startDate.toDateString()}`);
  Logger.log(`Today's date: ${today.toDateString()}`);
  var daysSinceEpochStartDate = Math.floor(startDate.getTime() / 8.64e7);
  var daysSinceEpochCurrDate = Math.floor(today.getTime() / 8.64e7);
  Logger.log(`Days since epoch to start date: ${daysSinceEpochStartDate}`);
  Logger.log(`Days since epoch to current date: ${daysSinceEpochCurrDate}`);
  Logger.log(
    `Start date ${startDate.toUTCString()}; index: ${startDate.getDay()}; dayIndex: ${dayIndex}`,
  );
  if (startDate.getDay() === dayIndex) {
    today = new Date(Date.parse(startDate.toUTCString()));
    if (daysSinceEpochStartDate < daysSinceEpochCurrDate) {
      today.setDate(today.getDate() + 7);
    }
  } else {
    today = new Date(Date.parse(startDate.toUTCString()));
    today.setDate(today.getDate() - startDate.getDay());
    if (startDate.getDay() > dayIndex) {
      today.setDate(today.getDate() + dayIndex + 7);
    } else {
      today.setDate(today.getDate() + dayIndex);
    }
  }
  return today;
}
