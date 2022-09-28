
function updateRefs() {

}

/**
 * Update sheet name based on data copied.
 * @param {SpreadsheetApp.Sheet} sheet
 */
function updateName(sheet) {
  const CYCLE_NAME_REGEX = "Cycle_([0-9])\.([0-9])\.?([0-9])?";
  // const CYCLE_MAJOR_VER_REGEX = /Cycle_[0-9]/;
  // const CYCLE_MINOR_VER_REGEX = "Cycle_([0-9])\.([0-9])\.?([0-9])?";
  var sheetName = sheet.getSheetName();
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
    // sheet.setName(sheetName);
  }
}

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
  var cellR = range.createTextFinder("Set 3").matchEntireCell(true).matchCase(true).findNext();
  var editableRow = cellR.getRow();
  var cellC = range.createTextFinder("Warm-Up").matchEntireCell(true).matchCase(true).findNext();
  var editableCol = cellC.getColumn();
  var rowCount = range.getLastRow() - editableRow;
  var colCount = range.getLastColumn() - editableCol;
  // console.log(`Row: ${editableRow}`);
  // console.log(`Col: ${editableCol}`);
  // console.log(`End-R: ${range.getLastRow()}`);
  // console.log(`End-C: ${range.getLastColumn()}`);
  var editableRange = sheet.getRange(
    editableRow + 1, editableCol + 1, rowCount, colCount
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
 * Hide columns for which dates have been filled all the way down
 * @param {SpreadsheetApp.Sheet} sheet
 */
function hideFilledColumns(sheet) {
  const WEEK_SUMMARY_REGEX = "Week [0-9]";
  var textFinder = sheet.createTextFinder(WEEK_SUMMARY_REGEX);
  textFinder.useRegularExpression(true);
  textFinder.matchFormulaText(false);
  
  var weekHeaders = textFinder.findAll();
  weekHeaders.forEach(week => {
    var weekColNum = week.getColumn();
    var weekCol = sheet.getRange(1, weekColNum, sheet.getLastRow(), 1);
    var dateTextFinder = weekCol.createTextFinder(DATE_FORMAT_REGEX);
    dateTextFinder.useRegularExpression(true);
    dateTextFinder.matchFormulaText(false);
    dateTextFinder.matchEntireCell(true);
    if (dateTextFinder.findAll().length == MAIN_LIFT_NAMES.length) {
      Logger.log(`Hiding column ${weekColNum}`)
      sheet.hideColumn(weekCol);
    } else {
      Logger.log(`Column ${weekColNum} only has ${dateTextFinder.findAll().length} dates in it; ${MAIN_LIFT_NAMES.length} dates needed.`);

    }
  });
  
}

/**
 * Identify editable range of lift-specfic section.
 * @param {SpreadsheetApp.Sheet} sheet
 * @return {Object}
 */
function identifyLiftRanges(sheet) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sheetName = sheet.getName();
    Logger.log(`Identifying named ranges for sheet ${sheetName}.`)
    var liftRanges = {};
    var liftNames = []
    var lastRow = sheet.getLastRow();
    var column = sheet.getRange(1,1, lastRow, 1);
    var values = column.getValues().flat();
    var r1 = null;
    var c1 = 1;
    var r2 = null;
    var c2 = sheet.getLastColumn();
    var currLiftName = null;
    var setsFound = false;
  } catch(err) {
    handleException(err, "Could not set variables");
  }
  MAIN_LIFT_NAMES.forEach(lift => liftNames.push(lift));
  for (var i = values.length - 1; i > 0 && liftNames.length > 0; i--) {
    if (values[i] == "Notes") {
      if (r2 == null) {
        r2 = i+1;
      }
    } else if (!setsFound && SET_REGEX.test(values[i])) {
      setsFound = true;
    } else if (setsFound && liftNames.includes(values[i])) {
      currLiftName = values[i];
      if (r2 != null && r1 == null) {
        r1 = i+1;
      }
    }
    if (r1 != null && r2 != null && setsFound && currLiftName != null) {
      if (r1 < r2) {
        try {
          var rangeR1C1Notation = `R[${r1}]C[${c1}]R[${r2}]C[${c2}]`;
          Logger.log("Range for %s (R1C1): %s", currLiftName, rangeR1C1Notation);
          liftRanges[currLiftName] = sheet.getRange(r1, c1, (r2-r1)+1, (c2-c1)+1);
          Logger.log("Range for %s (A1): %s", currLiftName, liftRanges[currLiftName].getA1Notation());
        } catch (err) {
          handleException(err, `Could not generate range for ${currLiftName} at ${rangeR1C1Notation}`);
        } finally {
          r1 = null;
          r2 = null;
          currLiftName = null;
          setsFound = false;
        }
      }
    }
  }
  return liftRanges;
}

/**
 * Create named range.
 * @param {String} rangeName
 * @param {SpreadsheetApp.Range} range
 */
function createNamedRange(rangeName, range) {
  try {
    var ss = SpreadsheetApp.getActive();
    var rangeName = rangeName.replaceAll(NAMED_RANGE_CLEAN_REGEX, '_');
    Logger.log("Creating named range '%s'; A1 notation: %s", 
      rangeName,
      range.getA1Notation()
    );
    ss.setNamedRange(rangeName, range);
    if (ss.getNamedRanges().find(namedRange => namedRange.getName() == rangeName) == undefined) {
      throw new RuntimeError(`Range '${rangeName}' not created successfully.`);
    }
    // liftNames = liftNames.filter(lift => lift != currLiftName);
    Logger.log(`Successfully create named range ${rangeName}`);
  } catch (err) {
    handleException(err, `Error creating named range ${rangeName} at ${range.getA1Notation()}`);
  }
}

/**
 * Update Estimated 1RMs after cycle completion.
 */
function updateEstimated1Rms() {
  
}

/**
 * Hide and unhide sections based on the current date and current lift.
 * @param {String} sectionName The section to view
 * @param {String} columnNum The column to view
 */
function updateView() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getActiveSheet();
}