function updateName() {

}

function updateRefs() {

}

/**
 * Clear data, but preserve conditional formatting of modifiable fields.
 * @param {SpreadsheetApp.Sheet} sheet
 */
function clearDates(sheet) {
  var textFinder = sheet.createTextFinder(DATE_FORMAT_REGEX).useRegularExpression(true);
  textFinder.findAll().forEach(match => match.clearContent());
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
  } catch(err) {
    handleException(err, "Could not set variables");
  }
  MAIN_LIFT_NAMES.forEach(lift => liftNames.push(lift));
  for (var i = values.length - 1; i > 0 && liftNames.length > 0; i--) {
    if (values[i] == "Notes") {
      if (r2 == null) {
        r2 = i+1;
      }
    } else if (liftNames.includes(values[i])) {
      currLiftName = values[i];
      if (r2 != null && r1 == null) {
        r1 = i+1;
      }
    }
    if (r1 != null && r2 != null && currLiftName != null) {
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
