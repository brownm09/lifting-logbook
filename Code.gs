const TOC_SHEET_NAME = "TOC";
const CYCLE_SHEET_PREFIX = "Cycle_";
const COPIED_SHEET_PREFIX = "Copy of ";
const PRIOR_CYCLE_INDEX = "D1";
const CURRENT_TM_INDEX = "C7:C11";

/**
 *  Sort sheets
 *
 */
function sortSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  var sheetNameArray = [];
  var numSheetsToSort = sheets.length;
   
  try {
    for (var i = 0; i < numSheetsToSort; i++) {
      sheetNameArray.push(sheets[i].getName());
    }
    
    sheetNameArray.sort();
      
    for(var j = numSheetsToSort - 1; j > 0; j--) {
      if(sheetNameArray[j].startsWith(CYCLE_SHEET_PREFIX)) {
        ss.setActiveSheet(ss.getSheetByName(sheetNameArray[j]));
        ss.moveActiveSheet(1);
      }      
    }
    ss.setActiveSheet(ss.getSheetByName(TOC_SHEET_NAME));
    ss.moveActiveSheet(1);
  } catch (err) {
    handleException(err, "Error sorting sheets");
  }
}

/**
 *  Creates a TOC of sheets as formula based hyperlinks
 *
 */
function updateTOC() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetList = ss.getSheets();
  try {
    var tocSheet = ss.getSheetByName(TOC_SHEET_NAME);
    ss.setActiveSheet(tocSheet);
    const idNameTuples = generateSheetIdTuples(sheetList);
    // cropSheet(tocSheet);
    emptySheet(tocSheet);
    tocSheet.getRange("A1:A" + idNameTuples.length).insertCells(SpreadsheetApp.Dimension.ROWS);
    const cellData = generateSheetLinks(idNameTuples);
    var range = tocSheet.getRange("A1:A" + idNameTuples.length);
    range.setValues(cellData);
    SpreadsheetApp.flush();
    tocSheet.autoResizeColumn(1);
  } catch (err) {
    handleException(err, "Error generating TOC");
  }
}

/**
 *  Returns tuples of (gid, sheet name)
 *
 *  @param {SpreadsheetApp.Sheet[]} sheets 
 *  @return {String[][]}
 *
 */
function generateSheetIdTuples(sheets) {
  var tuples = [];
  var gid, name;

  for (var i = 0; i < sheets.length; i++) {
    gid = sheets[i].getSheetId();
    name = sheets[i].getName();
    if (name !== TOC_SHEET_NAME) {
      tuples.push([ gid, name ]);
    }
  }
  return tuples;
}

/**
 *  Returns array of forumlas containing hyperlinks (ex. =HYPERLINK("#gid=478994393","7th Week Deload"))
 *
 *  @param {String[][]} tuples
 *  @param {SpreadsheetApp.Sheet} sheet
 *  @return {String[][]}
 *
 */
function generateSheetLinks(tuples) {
  var data = [];
  var gid, name;

  for (var i = 0; i < tuples.length; i++) {
    gid = tuples[i][0];
    name = tuples[i][1];
    data.push([`=HYPERLINK("#gid=${gid}","${name}")`]);
  }
  return data;
}

/**
 *  Delete blank rows and columns from sheet
 *
 *  @param {SpreadsheetApp.Sheet} sheet
 *
 */
function cropSheet(sheet) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const maxCols = sheet.getMaxColumns();
  const maxRows = sheet.getMaxRows();
  if (maxCols > lastCol) {
    sheet.deleteColumns(lastCol + 1, maxCols - lastCol);
  }
  if (maxRows > lastRow) {
    sheet.deleteRows(lastRow + 1, maxRows - lastRow);
  }
}

/**
 *  Delete all rows and columns from sheet
 *
 *  @param {SpreadsheetApp.Sheet} sheet
 *
 */
function emptySheet(sheet) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const maxCols = sheet.getMaxColumns();
  const maxRows = sheet.getMaxRows();
  if (maxCols > 1) {
    sheet.deleteColumns(2, maxCols - 1);
  }
  if (maxRows > 1) {
    sheet.deleteRows(2, maxRows - 1);
  }
  sheet.getRange("A1").clear();
}

/**
 *  Creates a TOC of sheets as formula based hyperlinks
 *
 */
function cropAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    cropSheet(sheets[i]);
  }
}

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

function updateRefs() {

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
