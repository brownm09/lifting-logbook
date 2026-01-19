import { createGrid } from "../core/workout";
import { clearAllEntries, clearDates } from "./clearData";
import {
  DASH_SHEET_NAME,
  RPT_HIST_SHEET_NAME,
  RPT_SPEC_SHEET_NAME,
  TM_SHEET_NAME,
} from "./constants";
import { getCurrSheetName, getProxyCellPivoted, newCycle } from "./dashboard";
import { cropSheet, formatSheet } from "./format";
import { updateRptHistory } from "./history";
import { updateTrainingMaxesWithSpec } from "./maxes";
import { createNamedRanges, validateNamedRanges } from "./namedRanges";
import { nextDate, updateName, updatePreviousSheetName } from "./update";
import { updateView } from "./view";

/**
 * Process completed RPT workout sheet.
 * @param {SpreadsheetApp.Sheet} currSheet Current sheet object
 */
function processCompletedSheetRpt(currSheet) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var specSheet = ss.getSheetByName(RPT_SPEC_SHEET_NAME);
  var tmSheet = ss.getSheetByName(TM_SHEET_NAME);
  var histSheet = ss.getSheetByName(RPT_HIST_SHEET_NAME);
  var dashSheet = ss.getSheetByName(DASH_SHEET_NAME);
  var specData = specSheet.getDataRange().getValues();
  var tmData = tmSheet.getDataRange().getValues();
  var dashData = dashSheet.getDataRange().getValues();
  updateRptHistory(currSheet, histSheet);
  var histData = histSheet.getDataRange().getValues();
  console.log(`Program spec data: \n\t${specData.join("\n\t")}`);
  console.log(`Training max data (before): \n\t${tmData.join("\n\t")}`);
  updateTrainingMaxesWithSpec(specData, tmData, histData);
  console.log(`Training max data (after): \n\t${tmData.join("\n\t")}`);
  tmSheet.getRange(1, 1, tmData.length, tmData[0].length).setValues(tmData);
  const prevCycleDateStr = getProxyCellPivoted(dashData, "Cycle Date");
  const prevCycleDate = new Date(Date.parse(prevCycleDateStr));
  const result = createGrid(specData, tmData, nextDate(1, prevCycleDate));
  console.log(`Cycle grid: \n\t${result.join("\n\t")}`);
  cropSheet(tmSheet);
  cropSheet(dashSheet);
  newCycle(dashData);
  dashSheet
    .getRange(1, 1, dashData.length, dashData[0].length)
    .setValues(dashData);
  const newSheetName = getCurrSheetName(dashData);
  const newSheet = ss.getSheetByName(newSheetName);
  newSheet.getRange(1, 1, result.length, result[0].length).setValues(result);
  cropSheet(newSheet);
  formatSheet(newSheet);
  ss.deleteSheet(currSheet);
  // // updateRptNumbers(currSheet);
  // clearRptEntries(currSheet);
  // clearDates(currSheet);
  // incrementCycle(currSheet);
}

/**
 * Process completed 5/3/1 workout sheet.
 * @param {SpreadsheetApp.Sheet} currSheet Current sheet object
 * @param {SpreadsheetApp.Spreadsheet} currSpreadsheet Current sheet object
 */
function processCompletedSheet531(currSheet, currSpreadsheet) {
  clearDates(currSheet);
  var prevSheetName = updatePreviousSheetName(currSheet);
  updateName(currSheet);
  Logger.log(`Current sheet name 1: ${currSheet.getName()}`);
  currSheet = currSpreadsheet.getActiveSheet();
  Logger.log(`Current sheet name 2: ${currSheet.getName()}`);
  createNamedRanges(currSheet);
  validateNamedRanges(currSheet);
  clearAllEntries(currSheet);
  updateView(currSheet);
  // updateCurrSheetRef(currSheet);
  // sortSheets();
  // updateTOC();
}

export { processCompletedSheet531, processCompletedSheetRpt };
