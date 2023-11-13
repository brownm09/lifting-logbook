
function onEdit(e) {
  var currSpreadsheet = e.source;
  var currSheet = currSpreadsheet.getActiveSheet();
  var currSheetName = currSheet.getName();
  const currSheetId = currSheet.getSheetId();
  Logger.log(`Current sheet: ${currSheetName}`);
  Logger.log(`Change type: ${e.changeType}`);
  if (COPIED_SHEET_NAME_REGEX.test(currSheetName) || currSheetName.startsWith("Copy of RPT_Week_")) { // This takes too long
    try {
      if (currSheetName.includes("RPT_")) {
        updateRptNumbers(currSheet);
        clearRptEntries(currSheet);
        clearDates(currSheet);
        updateNameRpt(currSheet);
      } else if (currSheetName.includes("Cycle_")) {
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
        // sortSheets();
        // updateTOC();
      }
    } catch (err) {
      currSpreadsheet.setActiveSheet(currSpreadsheet.getSheetByName(prevSheetName));
      handleException(err, `An exception occurred when updating this sheet`);
      // if (err.range.getSheet().getSheetId() === currSheetId) {
        currSpreadsheet.deleteSheet(currSheet);
      // } else {
        // handleException(err, "An error occurred while updating the TOC or sorting sheets");
      // }
    }
  } else if (CYCLE_SHEET_NAME_REGEX.test(currSheetName)) {
    // var currRange = e.range; 
    var currWeekRangeUrl = currSheet.getRange(CURRENT_WEEK_INDEX).getDataSourceUrl();
    var currLiftRangeUrl = currSheet.getRange(CURRENT_LIFT_INDEX).getDataSourceUrl();
    var currProgramRangeUrl = currSheet.getRange(CURRENT_PROGRAM_INDEX).getDataSourceUrl();
    const currValue = e.range.getValue();

    if (e.range.getDataSourceUrl() == currWeekRangeUrl) {
      Logger.log(`Updated current week selection at ${e.range.getA1Notation()} to ${currValue}. Updating view accordingly.`);
      updateColView(currSheet, currValue);
    }
    if (e.range.getDataSourceUrl() == currLiftRangeUrl) {
      Logger.log(`Updated current lift selection at ${e.range.getA1Notation()} to ${currValue}. Updating view accordingly.`);
      updateLiftView(currSheet, currValue);
    }
    if (e.range.getDataSourceUrl() == currProgramRangeUrl) {
      Logger.log(`Updated current program selection at ${e.range.getA1Notation()} to ${currValue}. Updating sheet name accordingly.`);
      updateProgram(currSheet, currValue);
      // updateSpecialSetRow(currSheet, currValue);
      validateNamedRanges(currSheet);
      updateTOC();
    }
  }
}

function onOpen() {
  // updateTOC();
}

function onChange(e) {
  var currSpreadsheet = e.source;
  var currSheet = currSpreadsheet.getActiveSheet();
  var changeTypeStr = new String(e.changeType);
  Logger.log(`Change type: ${changeTypeStr}`);
  Logger.log(`Current sheet: ${currSheet.getSheetName()}`);
  // SpreadsheetApp.getUi().alert(`Change type: ${changeTypeStr}`);
  try {
    if (changeTypeStr == "INSERT_GRID" || changeTypeStr == "REMOVE_GRID") {
      try {
        if (changeTypeStr == "INSERT_GRID") {
          /**
           * `updateName(currSheet)` must be handled by onEdit()
           * Need to send/receive Promise to onEdit() here before sorting sheets and updating TOC.
           * Alternatively, can just sortSheets() and updateTOC() after editing the name.
           */
          // 
          // clearEntries(sheet, range);
          // updateRefs(currSheet);
          // sortSheets();
          // updateTOC();
        } else {
          sortSheets();
          updateTOC();
        }
        Logger.log("Updated references.");
      } catch(err) {
        handleException(err, "Error updating references");
      }
      // Logger.log("Updated TOC.");
    } else if (changeTypeStr == "EDIT") {
      // Range is not included in onChange() event; see onEdit()
    }
  } catch (err) {
    handleException(err, "Error generating TOC");
  }
  Logger.log("Completed onChange()");
}

// function createInsertGridTrigger() {
//   var triggers = ScriptApp.getProjectTriggers();
//   var shouldCreateTrigger = true;
//   triggers.forEach(function (trigger) {
//     if(trigger.getEventType() === ScriptApp.ChangeType.INSERT_GRID && trigger.getHandlerFunction() === "updateTOC") {
//       shouldCreateTrigger = false; 
//     }
//   });
  
//   if(shouldCreateTrigger) {
//     ScriptApp.newTrigger("sendEmailReport")
//       .forSpreadsheet(SpreadsheetApp.getActive())
//       // .onEdit()
//       .create();
//   }
// }
