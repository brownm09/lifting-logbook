function deleteNamedRanges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var namedRanges = ss.getNamedRanges();
  namedRanges.forEach(namedRange => {
    Logger.log("Removing named range '%s'", namedRange.getName());
    ss.removeNamedRange(namedRange.getName())
  });
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
    result = identifyLiftRanges(testSheet);
    if (result != null) {
      Logger.log(result);
      MAIN_LIFT_NAMES.forEach((liftName) => {
        var rangeName = `${testSheetName2}.${liftName}`
        createNamedRange(rangeName, result[liftName]);
      });
      ss.getNamedRanges().forEach(namedRange => {
        Logger.log("Removing named range '%s'", namedRange.getName());
        ss.removeNamedRange(namedRange.getName())
      });
    } else {
      Logger.log("Result = null");
    }
  } catch(err) {
    handleException(err, "Exception found while identifying named ranges");
  }
}
