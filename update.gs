
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
    Logger.log(scheme);
    if (cycleMinorNum >= 2 && scheme == "2/1" || cycleMinorNum >= 3 && scheme == "3/2") {
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
        new RegExp(`Cycle_${cycleMajorNum}.${cycleMinorNum}`), 
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
