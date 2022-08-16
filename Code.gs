/**
 *  Print exception message to screen
 *
 *  @param {Error} err
 *  @param {String} msg
 *
 */
function handleException(err, msg) {
  const range = err.range;
  var errStr, errLocation;
  if (range === undefined) {
    errStr = `Error: ${err}\n${msg}`
  } else {
    errLocation = range.getA1Notation();
    errStr = `Error at ${errLocation}: ${err}\n${msg}`
  }
  Logger.log(errStr);
  SpreadsheetApp.getUi().alert(errStr);
}

function onEdit(e) {
/*
  var currSpreadsheet = e.source;
  var currSheet = currSpreadsheet.getActiveSheet();
  var currSheetName = currSheet.getName()
  var currRange = e.range;
*/
  // e.range.getSheet ().autoResizeColumn (e.range.getColumn());
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
      if (changeTypeStr == "INSERT_GRID") {
        updateRefs();
      }
      sortSheets();
      updateTOC();
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
