import {
  RPT_HIST_SHEET_NAME,
  RPT_HISTORY_HEADERS,
  RPT_NAME_REGEX,
  SET_NAME_REGEX,
} from "./constants";
import { cropSheet } from "./format";

export function recreateLiftHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var histSheet;
  if (!(histSheet = ss.getSheetByName(RPT_HIST_SHEET_NAME))) {
    // ss.deleteSheet(histSheet);
    ss.insertSheet();
    histSheet = ss.getActiveSheet();
    histSheet.setName(RPT_HIST_SHEET_NAME);
  }
  histSheet.getDataRange().clearContent();
  histSheet
    .getRange(1, 1, 1, RPT_HISTORY_HEADERS.length)
    .setValues([RPT_HISTORY_HEADERS]);
  // histSheet.setFrozenRows(1);
  // histSheet.setFrozenColumns(4);
  var cycleSheetNameList = listCycleSheets();
  var cycleSheetList = cycleSheetNameList.map((cycleSheetName) => {
    return ss.getSheetByName(cycleSheetName);
  });
  cycleSheetList.forEach((cycleSheet) => {
    console.log(
      `Adding history from ${cycleSheet.getName()} to ${histSheet.getName()}`,
    );
    updateRptHistory(cycleSheet, histSheet);
  });
  cropSheet(histSheet);
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} cycleSheet
 */
export function updateRptHistory(cycleSheet, historySheet) {
  const sheetName = cycleSheet.getName();
  const matches = sheetName.match(RPT_NAME_REGEX);
  const cycleNum = matches[1];
  const setRepSchemeRegex = "([0-9]+)\\s*×\\s*([0-9]+)";
  const dataRange = cycleSheet.getDataRange();
  // const setRepSchemes = dataRange.createTextFinder('×').startFrom(sheet.getRange(1,1)).findAll();
  const setRepSchemes = dataRange
    .createTextFinder(setRepSchemeRegex)
    .useRegularExpression(true)
    .startFrom(cycleSheet.getRange(1, 1))
    .findAll();
  const setRepSchemeIdxs = setRepSchemes.map((range) => {
    return range.getRow() - 1;
  });
  if (setRepSchemeIdxs.length) {
    const sheetData = cycleSheet.getDataRange().getValues();
    const liftData = findWorkingSetReps(
      sheetData,
      0,
      1,
      2,
      3,
      setRepSchemeIdxs,
    );
    console.log(`Lift data: ${liftData}`);
    liftData.forEach((row) => {
      console.log(`Lift data: ${row}`);
      appendLiftRecord(
        historySheet,
        "RPT",
        cycleNum,
        ...(row as [number, Date, string, string, string, number, string]),
      );
    });
  }
}

export function testUpdateRptHistory() {
  const WORK_SHEET_NAME = "RPT_Week_42_20240218";
  const HIST_SHEET_NAME = "Copy of LIFT_RECORDS";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var workSheet = ss.getSheetByName(WORK_SHEET_NAME);
  var histSheet = ss.getSheetByName(HIST_SHEET_NAME);
  updateRptHistory(workSheet, histSheet);
}

export function listCycleSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss
    .getSheets()
    .map((sheet) => {
      return sheet.getName();
    })
    .filter((sheetName) => {
      return sheetName.match(RPT_NAME_REGEX);
    });
}

export function testListCycleSheets() {
  console.log(listCycleSheets());
}

/**
 * Find reps performed for working set of an exercise.
 * @param {any[][]} dataValues The data range
 * @param {number} rowIdx The starting row index from which to search
 * @param {number} nameColIdx The column in which set identifiers are recorded
 * @param {number} specColIdx The column in which set-rep specs are recorded
 * @param {number} repsColIdx The column in which repetitions are recorded
 * @param {number} noteColIdx The column in which notes are recorded
 * @param {number[]} rowIdxs List of row indices where set-rep schemes are specified
 * @return {any[][]} the number of reps performed for the specified set of the specified lift
 */
export function findWorkingSetReps(
  dataValues,
  nameColIdx,
  specColIdx,
  repsColIdx,
  noteColIdx,
  rowIdxs,
) {
  var liftData = [],
    targetSetNum = 1,
    rowIdx,
    liftSpec,
    liftName,
    setNum,
    liftDate,
    setNotes,
    setReps,
    setWeight,
    setNameMatches,
    weightMatches,
    repMatches,
    setsFound,
    workoutDates = [],
    workoutNum = 0;
  // If rowIdxs is empty throw error
  do {
    setsFound = false;
    rowIdx = rowIdxs.shift();
    console.log(`Row ${rowIdx}: ${dataValues[rowIdx]}`);
    liftSpec = dataValues[rowIdx][specColIdx];
    liftName = dataValues[rowIdx][nameColIdx];
    liftDate = new Date(dataValues[rowIdx][repsColIdx]);
    if (!workoutDates.includes(liftDate.toLocaleDateString())) {
      workoutDates.push(liftDate.toLocaleDateString());
      console.log(`Workout dates: ${workoutDates}`);
    }
    workoutNum = workoutDates.length;
    for (var i = rowIdx; i < dataValues.length; i++) {
      if (
        (setNameMatches = `${dataValues[i][nameColIdx]}`.match(SET_NAME_REGEX))
      ) {
        if (!setsFound) {
          setsFound = true;
        }
        weightMatches = `${dataValues[i][specColIdx]}`
          .trim()
          .match("^([0-9\.]+)");
        repMatches = `${dataValues[i][repsColIdx]}`.trim().match("^([0-9]+)");
        setNotes = dataValues[i][noteColIdx];
        setNum = setNameMatches[1];
        if (weightMatches && weightMatches.length > 1) {
          setWeight = weightMatches[1];
          if (repMatches && repMatches.length > 1) {
            setReps = parseInt(repMatches[1]);
            liftData.push([
              workoutNum,
              liftDate,
              liftName,
              setNum,
              setWeight,
              setReps,
              setNotes,
            ]);
          }
        }
      } else {
        if (setsFound) {
          break;
        }
      }
    }
  } while (rowIdxs.length);
  return liftData;
}

/**
 * Update lift records.
 * @param {SpreadsheetApp.Sheet} historySheet Sheet containing historical lift data
 * @param {Date} date Date lift was performed
 * @param {string} lift Lift name
 * @param {float} weight Weight lifted for working set
 * @param {int} setNum Set number in sequence
 * @param {int} reps Reps performed for working set
 * @param {int} cycleNum Cycle number within current program
 * @param {int} workoutNum Workout number within current cycle
 * @param {string} notes Notes taken for lift
 */
export function appendLiftRecord(
  historySheet,
  progName,
  cycleNum,
  workoutNum,
  date,
  lift,
  setNum,
  weight,
  reps,
  notes,
) {
  const ROW_VALUES = [
    progName,
    cycleNum,
    workoutNum,
    date,
    lift,
    setNum,
    weight,
    reps,
    notes,
  ];
  if (!historySheet.getDataRange().getValues().includes(ROW_VALUES)) {
    historySheet.appendRow(ROW_VALUES);
  }
}
