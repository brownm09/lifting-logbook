
/**
 * Get current sheet name from dashboard data
 * @param {any[][]} dashData Dashboard data in 2D array
 */
function getCurrSheetName(dashData) {
  var progAbbr = getProxyCellPivoted(dashData, "Program");
  var cycleUnit = getProxyCellPivoted(dashData, "Cycle Unit");
  var cycleNum = getProxyCellPivoted(dashData, "Cycle #");
  var cycleDate = getProxyCellPivoted(dashData, "Cycle Date");
  return worksheetName(progAbbr, cycleUnit, cycleNum, cycleDate);
}

/**
 * Update sheet name based on dashboard data.
 * @param {any[][]} dashData Dashboard data in 2D array
 */
function newCycle(dashData) {
  var progAbbr = getProxyCellPivoted(dashData, "Program");
  var cycleUnit = getProxyCellPivoted(dashData, "Cycle Unit");
  var cycleNum = getProxyCellPivoted(dashData, "Cycle #");
  // var date = getProxyCellPivoted(dashData, "Cycle Date");
  var newName = worksheetName(progAbbr, cycleUnit, cycleNum + 1, nextDate(1));
  // Logger.log(`Incremented cycle name: ${newName}`);
  // sheet.setName(newName)
  updateProxyCellPivoted(dashData, "Cycle #", cycleNum + 1);
  updateProxyCellPivoted(dashData, "Cycle Date", nextDate(1));
  var sheetLink = generateSheetLinkFormula(newName);
  updateProxyCellPivoted(dashData, "Sheet Link", sheetLink);
}

function testNextDate() {
  Logger.log(`Next Monday: ${nextDate(1).toLocaleDateString()}`);
}

function testNewCycle() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var dashSheet = ss.getSheetByName(DASH_SHEET_NAME);
  var dashData = dashSheet.getDataRange().getValues();
  console.log(`Dashboard data (before): \n\t${dashData.join('\n\t')}`)
  newCycle(dashData);
  console.log(`Dashboard data (after): \n\t${dashData.join('\n\t')}`)
  var newSheetName = getCurrSheetName(dashData);
  console.log(`New sheet name: ${newSheetName}`);
}


/**
 * Generate workout sheet name from program, cycle number, and cycle data.
 * @param {string} progName
 * @param {string} cycleUnit
 * @param {number} cycleNum
 * @param {Date} cycleDate
 * @return {string} Resulting string
 */
function worksheetName(progName, cycleUnit, cycleNum, cycleDate) {
  var dateStr = cycleDate.toISOString().slice(0,10).replace(/-/g,"");
  return `${progName}_${cycleUnit}_${cycleNum}_${dateStr}`;
}

/**
 * Update dashboard elements based on current sheet.
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {any[][]} dashData Dashboard data in 2D array
 */
// function updateDashboardData(dashData) {
//   var cycleNum = parseInt(matches[1]);
//   updateProxyCellPivoted(dashData, "Cycle #", cycleNum);
//   var dateStr = matches[2];
//   var cycleDate = new Date(dateStr.substring(0,4), parseInt(dateStr.substring(4,6)) - 1, dateStr.substring(6,8));
//   updateProxyCellPivoted(dashData, "Cycle Date", cycleDate);
//   var sheetLink = generateSheetLinkFormula(worksheetName());    
//   updateProxyCellPivoted(dashData, "Sheet Link", sheetLink);
// }

// function updateDashboardData(sheet, dashData) {
//   var sheetName = sheet.getSheetName();
//   sheetName = sheetName.replace(COPIED_SHEET_PREFIX, '');
//   var matches = sheetName.match(RPT_NAME_REGEX);
//   if (matches == null) {
//     Logger.log(`Unable to match versioning syntax for ${sheetName}.`);
//   } else {
//     var cycleNum = parseInt(matches[1]);
//     updateProxyCellPivoted(dashData, "Cycle #", cycleNum);
//     var dateStr = matches[2];
//     var cycleDate = new Date(dateStr.substring(0,4), parseInt(dateStr.substring(4,6)) - 1, dateStr.substring(6,8));
//     updateProxyCellPivoted(dashData, "Cycle Date", cycleDate);
//     var sheetLink = generateSheetLinkFormula(sheetName);    
//     updateProxyCellPivoted(dashData, "Sheet Link", sheetLink);
//   }
// }

function testUpdateDashboardData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var dashSheet = ss.getSheetByName("DASHBOARD");
  var workSheet = ss.getSheetByName("RPT_Week_44_20240303");
  var dashData = dashSheet.getDataRange().getValues();
  // var tmData = tmSheet.getDataRange().getValues();
  // var workData = workSheet.getDataRange().getValues();
  console.log(`Dashboard data (before): \n\t${dashData.join('\n\t')}`)
  updateDashboardData(workSheet, dashData);
  console.log(`Dashboard data (after): \n\t${dashData.join('\n\t')}`)
  dashSheet.getDataRange().setValues(dashData);
  cropSheet(dashSheet);
  dashSheet.autoResizeColumns(1, dashSheet.getLastColumn());
}

/**
 * Update data based on row header
 * @param {any[][]} data 2D array of data to update
 * @param {string} rowHeader Target row header
 * @param {any} val New value to write in "cell"
 */
function getProxyCellPivoted(data, rowHeader) {
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === rowHeader) {
      return data[i][data[i].length - 1];
    }
  }
}

/**
 * Update data based on row header
 * @param {any[][]} data 2D array of data to update
 * @param {string} rowHeader Target row header
 * @param {any} val New value to write in "cell"
 */
function updateProxyCellPivoted(data, rowHeader, val) {
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === rowHeader) {
      data[i][data[i].length - 1] = val;
      break;
    }
  }
  return null;
}

/**
 * Build hyperlink formula using sheet name; creates sheet if no sheet with given name exists.
 * @param {string} rowHeader Target sheet name
 */
function generateSheetLinkFormula(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet;
  if (sheet = ss.getSheetByName(sheetName) === null) {
    ss.insertSheet();
    sheet = ss.getActiveSheet();
    sheet.setName(sheetName);
  }
  var gid = sheet.getSheetId();
  return `=HYPERLINK("#gid=${gid}","${sheetName}")`;
}
