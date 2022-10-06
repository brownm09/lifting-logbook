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
    const currSheet = ss.getActiveSheet();
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
      ss.setActiveSheet(currSheet);
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