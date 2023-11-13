
/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @return {String} New program name
 */
function updateProgram(sheet, programName) {
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
function getProgramAbbreviation(programName) {
  var programRefSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROG_REF_SHEET_TITLE);
  // var sheetValues = programRefSheet.getSheetValues();
  var row = getRowByIndex(programRefSheet, 1);
  var col = getColByIndex(programRefSheet, 1);
  // return sheetValues
  //   [row.indexOf(PROG_REF_ABBRV_COL_TITLE)]
  //   [col.indexOf(programName)];
  // Logger.log(row);
  // Logger.log(col);
  return programRefSheet.getRange(
    col.indexOf(programName) + 1,
    row.indexOf(PROG_REF_ABBRV_COL_TITLE) + 1,
  ).getValue();
}


/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @return {String} Previous sheet name
 */
function updatePreviousSheetName(sheet) {
  var sheetName = sheet.getSheetName();
  sheetName = sheetName.replace(COPIED_SHEET_PREFIX, '');
  var previousCycleRange = sheet.getRange(PREVIOUS_CYCLE_INDEX);
  previousCycleRange.setValue(sheetName);
  // TODO: Set hyperlink
  return sheetName;
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
function updateName(sheet) {
  // const CYCLE_MAJOR_VER_REGEX = /Cycle_[0-9]/;
  // const CYCLE_MINOR_VER_REGEX = "Cycle_([0-9])\.([0-9])\.?([0-9])?";
  var sheetName = sheet.getSheetName();
  sheetName = sheetName.replace(COPIED_SHEET_PREFIX, '');
  var matches = sheetName.match(CYCLE_NAME_REGEX);
  if (matches == null) {
    Logger.log(`Unable to match versioning syntax for ${sheetName}.`);
  } else {
    var cycleMajorNum = parseInt(matches[1]);
    var cycleMinorNum = parseInt(matches[2]);
    var scheme = sheet.getRange(1,4).getValue();
    Logger.log(`Major cycle num: ${cycleMajorNum}`);
    Logger.log(`Minor cycle num: ${cycleMinorNum}`);
    Logger.log(`Scheme: ${scheme}`);
    if (cycleMinorNum >= 5 && scheme == "2/1" || cycleMinorNum >= 7 && scheme == "3/2") {
      Logger.log(`Bumping major cycle version.`);
      // cycleMajorNum++;
      // cycleMinorNum = 0;
      sheetName.replace(
        new RegExp(`Cycle_${cycleMajorNum}\.${cycleMinorNum}`), 
        `Cycle_${cycleMajorNum + 1}.0`
      );
    } else {
      Logger.log(`Bumping minor cycle version.`);
      // cycleMinorNum++;
      sheetName = sheetName.replace(
        new RegExp(`Cycle_${cycleMajorNum}\.${cycleMinorNum}`), 
        `Cycle_${cycleMajorNum}.${cycleMinorNum + 1}`
      );
    }
    Logger.log(sheetName);
    sheet.setName(sheetName);
  }
}

/**
 * Update Estimated 1RMs after cycle completion.
 */
function updateEstimated1Rms() {
  
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
function updateRptNumbers(sheet) {
  // const coreLiftRange = 
  const setRepSchemeRegex = "([0-9]+)\\s*×\\s*([0-9]+)";
  const setRepSchemes = sheet.getDataRange().createTextFinder('×').findAll();
  const lastColumnIdx = sheet.getLastColumn();
  const nameColumnIdx = 1;
  const repsOffset = 2;
  setRepSchemes.forEach((range) => {
    var matches = range.getValue().toString().match(setRepSchemeRegex);
    var sets = parseInt(matches[1]);
    var minReps = parseInt(matches[2]);

    var rowIdx = range.getRow();
    var lift = sheet.getRange(rowIdx, nameColumnIdx).getValue();
    var topSetReps = parseInt(sheet.getRange(rowIdx + repsOffset, lastColumnIdx).getValue());
    Logger.log(`Processing lift "${lift}"`);
    if (topSetReps >= minReps) {
      Logger.log(`${lift}: Reps in top set (${topSetReps}) >= progress threshold (${minReps}). Updating...`);
      updateTrainingMaxRpt(sheet, lift);
    }
  });
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} lift
 */
function updateTrainingMaxRpt(sheet, lift, onDiet = true) {
  const SMALL_INC_LIFTS = ["OH Press", "Bench P.", "BB Row", "Chin-up", "CBL Curls", "Dip"];
  const rangeStartRow = sheet.getDataRange().createTextFinder("Core Lift").findNext().getRow();
  const rptLiftRange = sheet.getRange(rangeStartRow, 1, rangeStartRow + 6, sheet.getLastColumn());
  const liftRow = rptLiftRange.createTextFinder(lift).findNext().getRow();
  const tmCol = rptLiftRange.createTextFinder("TM").findNext().getColumn();
  var origTmCell = sheet.getRange(liftRow, tmCol);
  var origTmVal = parseInt(origTmCell.getValue());
  var percentBump = origTmVal * 1.025;
  var roundAndBumpAmt = SMALL_INC_LIFTS.includes(lift) ? 2.5 : 5;
  var absoluteBump = origTmVal + roundAndBumpAmt;
  Logger.log(`[${lift}] Original training max: ${origTmVal}; percent bump: ${percentBump}; absolute bump: ${absoluteBump}`);
  // origTmCell.setValue(`=MROUND(${Math.min(percentBump, absoluteBump)}, ${roundAndBumpAmt})`);
  origTmCell.setValue(`=MROUND(${onDiet ? absoluteBump : percentBump}, ${roundAndBumpAmt})`);
}

/**
 * Clear entries from sheet
 * @param {SpreadsheetApp.Sheet} sheet
 */
function clearRptEntries(sheet) {
  const lastCol = sheet.getLastColumn();
  const range = sheet.getRange(1, lastCol, sheet.getLastRow(), 1);
  Logger.log(`Resulting range: ${range.getA1Notation()}`);
  const numberRegex = '[0-9]+';
  range.createTextFinder(numberRegex)
    .matchEntireCell(true)
    .useRegularExpression(true)
    .replaceAllWith("");
}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
function updateNameRpt(sheet) {
  const RPT_NAME_REGEX = 'RPT_Week_([0-9]+)_([0-9]+)';
  const DATE_FORMAT_STR = 'YYYYMMDD';
  var sheetName = sheet.getSheetName();
  sheetName = sheetName.replace(COPIED_SHEET_PREFIX, '');
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
function nextDateStr(dateStr) {
  var date = new Date(dateStr.substring(0,4), parseInt(dateStr.substring(4,6)) - 1, dateStr.substring(6,8));
  return nextDate(0, date).toISOString().slice(0,10).replace(/-/g,"");
}

/**
 * Return date of following weekday 
 * dayIndex {number} day index (indexed 0 - 6, Sunday first)
 * startDate {Date} date to start calculation from, default today
 * return {String}
 */
function nextDate(dayIndex, startDate = new Date()) {
  var today = new Date();
  const offset = today.getTimezoneOffset();
  today = new Date(today.getTime() - (offset*60*1000))
  // today.setDate(today.getDate() + (dayIndex - 1 - today.getDay() + 7) % 7 + 1);
  today.setDate(today.getDate() + (dayIndex - 1 - today.getDay()) % 7 + 1);
  return today;
}
