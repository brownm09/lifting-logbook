/**
 *  Sort sheets
 *
 */
 function sortSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // const INIT_SHEET = ss.getActiveSheet();
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
      // ss.setActiveSheet(INIT_SHEET);
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
      tocSheet.getRange("A1:A" + idNameTuples.length + 1).insertCells(SpreadsheetApp.Dimension.ROWS);
      tocSheet.getRange("A1:C1")
        .setValues([["5/3/1 Cycles", "Leangains (RPT)", "Appendices"]])
        .setHorizontalAlignment('center')
        .setFontWeight('bold');
      // const cellData = generateSheetLinks(idNameTuples);
      const sheetLinks = generateSheetLinks(idNameTuples);
      const cellData = arrangeCellData(sheetLinks);
      var range = tocSheet.getRange("A2:C" + (cellData.length + 1));
      range.setValues(cellData);
      cropSheet(tocSheet);
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
      data.push(`=HYPERLINK("#gid=${gid}","${name}")`);
    }
    return data;
  }
  
  /**
   *  Returns array of forumlas containing hyperlinks (ex. =HYPERLINK("#gid=478994393","7th Week Deload"))
   *
   *  @param {String[][]} tuples
   *  @param {SpreadsheetApp.Sheet} sheet
   *  @return {String[][]}
   *
   */
  function arrangeCellData(sheetLinks) {
    var data = [];
    var gid, name;
    const columnData531 = sheetLinks.filter((data) => data.includes("\"Cycle_"));
    const columnDataRpt = sheetLinks.filter((data) => data.includes("\"RPT_"));
    const columnDataOther = sheetLinks.filter((data) => !(columnData531.includes(data) || columnDataRpt.includes(data)));
    Logger.log(`[DEBUG] Number of sheets per category: 5/3/1 (${columnData531.length}), RPT (${columnDataRpt.length}), Other (${columnDataOther.length})`);
    for (var i = 0; i < columnData531.length || i < columnDataRpt.length || i < columnDataOther.length; i++) {
      data.push([
        i < columnData531.length ? columnData531[i] : "",
        i < columnDataRpt.length ? columnDataRpt[i] : "",
        i < columnDataOther.length ? columnDataOther[i] : ""
      ]);
    }
    return data;
  }