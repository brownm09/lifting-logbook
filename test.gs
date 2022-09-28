function testRenameSheet() {
  const testSheetName1 = "Cycle_2.2.0_Leader_FSL";
  const testSheetName2 = "Cycle_3.0.0_Leader_SSL";
  // const sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(testSheetName1);
  // hideFilledColumns(sheet1);
  const sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(testSheetName2);
  updateName(sheet2);
}
function testHideColumns() {
  const testSheetName1 = "Cycle_2.2.0_Leader_FSL";
  const testSheetName2 = "Cycle_3.0.0_Leader_SSL";
  const sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(testSheetName1);
  hideFilledColumns(sheet1);
  const sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(testSheetName2);
  // hideFilledColumns(sheet2);
}

function testClearEntries() {
  const testSheetName2 = "Cycle_3.0.0_Leader_SSL";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(testSheetName2);
  const range = sheet.getRange("A37:E42");
  clearEntries(sheet, range);
}

function testClearDates() {
  const testSheetName2 = "Cycle_3.0.0_Leader_SSL";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var testSheet = ss.getSheetByName(testSheetName2);
    var result = clearDates(testSheet);
  } catch(err) {
    handleException(err, "Exception found while clearing dates from sheet");
  }
}

function testIdentfyLiftRanges() {
  const testSheetName1 = "Cycle_2.2.0_Leader_FSL";
  const testSheetName2 = "Cycle_3.0.0_Leader_SSL";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var testSheet = null;
  var result = null;
  try {
    testSheet = ss.getSheetByName(testSheetName2);
    result = identifyLiftRanges(testSheet);
    if (result != null) {
      Logger.log(result);
    } else {
      Logger.log("Result = null");
    }
  } catch(err) {
    handleException(err, "Exception found while identifying named ranges");
  }
}

function testCreateLiftRanges() {
  const testSheetName1 = "Cycle_2.2.0_Leader_FSL";
  const testSheetName2 = "Cycle_3.0.0_Leader_SSL";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var testSheet = null;
  var result = null;
  try {
    testSheet = ss.getSheetByName(testSheetName2);
    ss.setActiveSheet(testSheet);
    result = identifyLiftRanges(testSheet);
    if (result != null) {
      Logger.log(result);
      MAIN_LIFT_NAMES.forEach((liftName) => {
        createNamedRange(testSheetName2, liftName, result[liftName]);
      });
      // ss.getNamedRanges().forEach(namedRange => {
      //   Logger.log("Removing named range '%s'", namedRange.getName());
      //   ss.removeNamedRange(namedRange.getName())
      // });
    } else {
      Logger.log("Result = null");
    }
  } catch(err) {
    handleException(err, "Exception found while identifying named ranges");
  }
}

function testUpdateView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const testSheetName2 = "Cycle_3.0.0_Leader_SSL";
  testSheet = ss.getSheetByName(testSheetName2);
  ss.setActiveSheet(testSheet);
  updateColView(3);
  updateLiftView("Bench Press");
}

/**
 * A test helper function.
 */
function deleteNamedRanges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var namedRanges = ss.getNamedRanges();
  namedRanges.forEach(namedRange => {
    Logger.log("Removing named range '%s'", namedRange.getName());
    ss.removeNamedRange(namedRange.getName())
  });
}