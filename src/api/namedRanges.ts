import {
  MAIN_LIFT_NAMES,
  NAMED_RANGE_CLEAN_REGEX,
  SET_REGEX,
} from "./constants";
import { handleException } from "./error";
import { getColByIndex } from "./util";

/**
 * Create named ranges
 * @param {SpreadsheetApp.Sheet} sheet
 */
function createNamedRanges(sheet) {
  const currSheetName = sheet.getName();
  const liftRanges = identifyLiftRanges(sheet);
  MAIN_LIFT_NAMES.forEach((liftName) => {
    createNamedRange(currSheetName, liftName, liftRanges[liftName]);
  });
}

/**
 * Validate named ranges
 * @param {SpreadsheetApp.Sheet} sheet
 */
function validateNamedRanges(sheet) {
  const currSheetName = sheet.getSheetName();
  const currSheetId = `${sheet.getSheetId()}`;
  Logger.log(
    `Validating named ranges for sheet: ${currSheetName}, ID: ${currSheetId}`,
  );
  var namedRanges = sheet
    .getNamedRanges()
    .filter(
      (r) =>
        `${r.getRange().getSheet().getSheetId()}`.valueOf() ===
        currSheetId.valueOf(),
    );
  Logger.log(
    `# of Named ranges associated with current sheet: ${namedRanges.length}`,
  );
  namedRanges.forEach((range) => {
    var currLiftName = range.getRange().getValue();
    var expectedRangeName = getRangeName(currSheetName, currLiftName);
    var rangeName = range.getName();
    if (rangeName !== expectedRangeName) {
      Logger.log(
        `Name mismatch - Expected: ${expectedRangeName}, Actual: ${rangeName}`,
      );
      range.setName(expectedRangeName);
    }
  });
}

/**
 * Delete named ranges for current sheet
 * @param {SpreadsheetApp.Sheet} sheet
 */
function deleteNamedRanges(sheet) {
  const currSheetName = sheet.getSheetName();
  const currSheetId = sheet.getSheetId();
  var namedRanges = sheet
    .getNamedRanges()
    .filter((r) => {
      r.getRange().getSheet().getSheetId() === currSheetId;
    })
    .forEach((r) => {
      Logger.log(
        `Removing named range ${r.getName()} (${r.getRange().getA1Notation()})`,
      );
      r.remove();
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
    Logger.log(`Identifying named ranges for sheet ${sheetName}.`);
    var liftRanges = {};
    var liftNames = [];
    var values = getColByIndex(sheet, 1);
    var r1 = null;
    var c1 = 1;
    var r2 = null;
    var c2 = sheet.getLastColumn();
    var currLiftName = null;
    var setsFound = false;
  } catch (err) {
    handleException(err, "Could not set variables");
  }
  MAIN_LIFT_NAMES.forEach((lift) => liftNames.push(lift));
  for (var i = values.length - 1; i > 0 && liftNames.length > 0; i--) {
    if (values[i] == "Notes") {
      if (r2 == null) {
        r2 = i + 1;
      }
    } else if (!setsFound && SET_REGEX.test(values[i])) {
      setsFound = true;
    } else if (setsFound && liftNames.includes(values[i])) {
      currLiftName = values[i];
      if (r2 != null && r1 == null) {
        r1 = i + 1;
      }
    }
    if (r1 != null && r2 != null && setsFound && currLiftName != null) {
      if (r1 < r2) {
        try {
          var rangeR1C1Notation = `R[${r1}]C[${c1}]R[${r2}]C[${c2}]`;
          Logger.log(
            "Range for %s (R1C1): %s",
            currLiftName,
            rangeR1C1Notation,
          );
          liftRanges[currLiftName] = sheet.getRange(
            r1,
            c1,
            r2 - r1 + 1,
            c2 - c1 + 1,
          );
          Logger.log(
            "Range for %s (A1): %s",
            currLiftName,
            liftRanges[currLiftName].getA1Notation(),
          );
        } catch (err) {
          handleException(
            err,
            `Could not generate range for ${currLiftName} at ${rangeR1C1Notation}`,
          );
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
 * @param {String} sheetName
 * @param {String} liftName
 * @param {SpreadsheetApp.Range} range
 */
function createNamedRange(sheetName, liftName, range) {
  try {
    var ss = SpreadsheetApp.getActive();
    var rangeName = getRangeName(sheetName, liftName);
    Logger.log(
      "Creating named range '%s'; A1 notation: %s",
      rangeName,
      range.getA1Notation(),
    );
    ss.setNamedRange(rangeName, range);
    if (
      ss
        .getNamedRanges()
        .find((namedRange) => namedRange.getName() == rangeName) == undefined
    ) {
      throw new Error(`Range '${rangeName}' not created successfully.`);
    }
    // liftNames = liftNames.filter(lift => lift != currLiftName);
    Logger.log(`Successfully create named range ${rangeName}`);
  } catch (err) {
    handleException(
      err,
      `Error creating named range ${rangeName} at ${range.getA1Notation()}`,
    );
  }
}

/**
 * Retrieve named range for selected lift.
 * @param {String} sheetName The name of the sheet to get a named range for.
 * @param {String} liftName The name of the lift to get a named range for.
 * @return {SpreadsheetApp.NamedRange} The named range.
 */
function getLiftNamedRange(sheetName, liftName) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getActiveSheet();
  var rangeName = getRangeName(sheetName, liftName);
  Logger.log(sheet.getNamedRanges());
  return sheet
    .getNamedRanges()
    .find((namedRange) => namedRange.getName() == rangeName);
}

/**
 * Retrieve range name for selected lift.
 * @param {String} sheetName The name of the sheet to get a named range for.
 * @param {String} liftName The name of the lift to get a named range for.
 * @return {String} The sanitized range name.
 */
function getRangeName(sheetName, liftName) {
  return `${sheetName}.${liftName}`.replaceAll(NAMED_RANGE_CLEAN_REGEX, "_");
}

export {
  createNamedRange,
  createNamedRanges,
  deleteNamedRanges,
  getLiftNamedRange,
  getRangeName,
  identifyLiftRanges,
  validateNamedRanges,
};
