/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} tmSheet
 * @param {any[][]} tmData
 */
// function updateTrainingMaxes(tmSheet, tmData) {
//   var tmRange = tmSheet.getRange(1, 1, tmData.length, tmData[0].length);
//   tmRange.setValues(tmData);
// }

import {
  RPT_HIST_SHEET_NAME,
  RPT_HISTORY_HEADERS,
  RPT_SPEC_SHEET_NAME,
  TM_SHEET_NAME,
} from "./constants";

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} currSheet
 * @param {any[][]} tmData
 */
function updateCurrSheet(currSheet) {
  // var tmRange = tmSheet.getRange(1, 1, tmData.length, tmData[0].length);
  // tmRange.setValues(tmData);
  var tmRange = currSheet.getRange(6, 1, 15, 2);
  var tmData = tmRange.getValues();
  var currLift, currTm, tm;
  // DEFINE getTrainingMax(lift)
  for (var i = 0; i < tmData.length; i++) {
    currLift = tmData[i][0];
    tm = tmData[i][1];
    currTm = getTrainingMax(currLift);
    if (tm < currTm) {
      tmData[i][1] = currTm;
    }
  }
  tmRange.setValues(tmData);

  // var dateRange = currSheet.getRange(4, 17);
}

function getTrainingMax(liftName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tmSheet = ss.getSheetByName(TM_SHEET_NAME);
  const tmData = tmSheet.getDataRange().getValues();
  const TM_LIFT_COL_NUM = tmData[0].indexOf("Lift");
  const TM_WT_COL_NUM = tmData[0].indexOf("Weight");
  for (var i = 1; i < tmData.length; i++) {
    if (tmData[i][TM_LIFT_COL_NUM] === liftName) {
      return tmData[i][TM_WT_COL_NUM];
    }
  }
}

/**
 * Update training max data using historical lift records.
 * @param {any[][]} progSpecData Program spec data values
 * @param {any[][]} tmData Training max data values
 * @param {any[][]} histData Historical lift records data values
 */
function updateTrainingMaxesWithSpec(progSpecData, tmData, histData) {
  const TM_DATE_COL_NUM = tmData[0].indexOf("Date Updated");
  const TM_LIFT_COL_NUM = tmData[0].indexOf("Lift");
  const TM_WT_COL_NUM = tmData[0].indexOf("Weight");
  const PS_LIFT_COL_NUM = progSpecData[0].indexOf("Lift");
  const PS_REPS_COL_NUM = progSpecData[0].indexOf("Reps");
  const PS_INC_COL_NUM = progSpecData[0].indexOf("Increment");
  const HIST_WT_COL_NUM = RPT_HISTORY_HEADERS.indexOf("Weight");
  const HIST_LIFT_COL_NUM = RPT_HISTORY_HEADERS.indexOf("Lift");
  const HIST_DATE_COL_NUM = RPT_HISTORY_HEADERS.indexOf("Date");
  const HIST_SET_COL_NUM = RPT_HISTORY_HEADERS.indexOf("Set #");
  const HIST_REPS_COL_NUM = RPT_HISTORY_HEADERS.indexOf("Reps");
  var increment;

  for (var i = 1; i < tmData.length; i++) {
    console.log(`Training max: ${tmData[i]}`);
    for (var j = 0; j < progSpecData.length; j++) {
      if (progSpecData[j][PS_LIFT_COL_NUM] === tmData[i][TM_LIFT_COL_NUM]) {
        console.log(`Program spec: ${progSpecData[j]}`);
        increment = progSpecData[j][PS_INC_COL_NUM];
        for (var k = histData.length - 1; k >= 1; k--) {
          if (
            tmData[i][TM_LIFT_COL_NUM] === histData[k][HIST_LIFT_COL_NUM] &&
            tmData[i][TM_DATE_COL_NUM] < histData[k][HIST_DATE_COL_NUM] &&
            histData[k][HIST_SET_COL_NUM] === 1
          ) {
            console.log(
              `Evaluating set 1 of lift ${tmData[i][TM_LIFT_COL_NUM]} on date ${histData[k][HIST_DATE_COL_NUM]} against training max (${tmData[i][TM_DATE_COL_NUM]}) set on ${tmData[i][TM_DATE_COL_NUM]}`,
            );
            // console.log(`Lift record: ${histData[k]}`)
            if (tmData[i][TM_WT_COL_NUM] > histData[k][HIST_WT_COL_NUM]) {
              console.log(
                `Resetting ${tmData[i][TM_LIFT_COL_NUM]} training max to ${histData[k][HIST_WT_COL_NUM]} (from ${tmData[i][TM_WT_COL_NUM]}).`,
              );
              tmData[i][TM_WT_COL_NUM] = histData[k][HIST_WT_COL_NUM];
              tmData[i][TM_DATE_COL_NUM] = histData[k][HIST_DATE_COL_NUM];
            }
            if (
              tmData[i][TM_WT_COL_NUM] <= histData[k][HIST_WT_COL_NUM] &&
              histData[k][HIST_REPS_COL_NUM] >= progSpecData[j][PS_REPS_COL_NUM]
            ) {
              console.log(
                `Incrementing ${tmData[i][TM_LIFT_COL_NUM]} training max to ${histData[k][HIST_WT_COL_NUM] + increment} (from ${tmData[i][TM_WT_COL_NUM]}).`,
              );
              tmData[i][TM_WT_COL_NUM] =
                histData[k][HIST_WT_COL_NUM] + increment;
              tmData[i][TM_DATE_COL_NUM] = histData[k][HIST_DATE_COL_NUM];
              break;
            }
          }
        }
        break;
      }
    }
  }
}

function testUpdateTrainingMaxesWithSpec() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var specSheet = ss.getSheetByName(RPT_SPEC_SHEET_NAME);
  var tmSheet = ss.getSheetByName(TM_SHEET_NAME);
  var histSheet = ss.getSheetByName(RPT_HIST_SHEET_NAME);
  var specData = specSheet.getDataRange().getValues();
  var tmData = tmSheet.getDataRange().getValues();
  var histData = histSheet.getDataRange().getValues();
  console.log(`Historical lift data: \n\t${histData.join("\n\t")}`);
  console.log(`Training max data (before): \n\t${tmData.join("\n\t")}`);
  updateTrainingMaxesWithSpec(specData, tmData, histData);
  console.log(`Training max data (after): \n\t${tmData.join("\n\t")}`);
  // var tmRange = tmSheet.getRange(1, 1, tmData.length, tmData[0].length);
  // tmRange.setValues(tmData);
}

export {
  getTrainingMax,
  testUpdateTrainingMaxesWithSpec,
  updateCurrSheet,
  updateTrainingMaxesWithSpec,
};
