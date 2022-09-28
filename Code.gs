
function onEdit(e) {
  var currSpreadsheet = e.source;
  var currSheet = currSpreadsheet.getActiveSheet();
  // var currSheetName = currSheet.getName()
  // var currRange = e.range;
  var currWeekRangeUrl = currSheet.getRange(CURRENT_WEEK_INDEX).getDataSourceUrl();
  var currLiftRangeUrl = currSheet.getRange(CURRENT_LIFT_INDEX).getDataSourceUrl();
  // SpreadsheetApp.getUi().alert(`Current week selection at ${e.range.getA1Notation()} to ${e.range.getValue()}. Updating view accordingly.`);
  // SpreadsheetApp.getUi().alert(`Data source URL: ${e.range.getDataSourceUrl()}`);
  if (e.range.getDataSourceUrl() == currWeekRangeUrl) {
    Logger.log(`Updated current week selection at ${e.range.getA1Notation()} to ${e.range.getValue()}. Updating view accordingly.`);
    updateColView(e.range.getValue());
  }
  if (e.range.getDataSourceUrl() == currLiftRangeUrl) {
    Logger.log(`Updated current lift selection at ${e.range.getA1Notation()} to ${e.range.getValue()}. Updating view accordingly.`);
    updateLiftView(e.range.getValue());
  }
}


function onOpen() {
  // updateTOC();
}

function onChange(e) {
  var changeTypeStr = new String(e.changeType);
  Logger.log(`Change type: ${changeTypeStr}`);
  // SpreadsheetApp.getUi().alert(`Change type: ${changeTypeStr}`);
  try {
    
    if (changeTypeStr == "INSERT_GRID" || changeTypeStr == "REMOVE_GRID") {
      try {
        if (changeTypeStr == "INSERT_GRID") {
          updateRefs();
        }
        Logger.log("Updated references.");
      } catch(err) {
        handleException(err, "Error updating references");
      }
      sortSheets();
      updateTOC();
      Logger.log("Updated TOC.");
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
