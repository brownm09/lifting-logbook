/**
 * Deletes all sheets matching the RPT_Week pattern from any previous year,
 * keeping only the single most recent sheet and renaming it to Week 00.
 */
export function cleanupAllPreviousYearSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const currentYear = new Date().getFullYear();

  const dryRun = false;

  // Regex to match "RPT_Week_" followed by 2 digits, underscore, then 8 digits
  const reportRegex = /^RPT_Week_(\d{2})_(\d{8})$/;

  let allOldSheets = [];

  Logger.log(
    "--- Starting Global Cleanup for all years prior to " +
      currentYear +
      " ---",
  );

  // 1. Identify all matching sheets from ANY year before the current one
  sheets.forEach(function (sheet) {
    var sheetName = sheet.getName();
    var match = sheetName.match(reportRegex);

    if (match) {
      var datePart = match[2];
      var sheetYear = parseInt(datePart.substring(0, 4), 10);

      if (sheetYear < currentYear) {
        allOldSheets.push({
          sheet: sheet,
          name: sheetName,
          dateValue: parseInt(datePart, 10),
          datePart: datePart,
        });
      }
    }
  });

  // 2. Sort all found sheets by dateValue ascending (Oldest to Newest)
  allOldSheets.sort(function (a, b) {
    return a.dateValue - b.dateValue;
  });

  Logger.log("Total matching previous sheets found: " + allOldSheets.length);

  // 3. Process Deletion and Renaming
  if (allOldSheets.length > 0) {
    // The last item in the sorted array is the most recent sheet across all past years
    const keepSheetObj = allOldSheets[allOldSheets.length - 1];

    // Delete every sheet in the list except the last one
    for (var i = 0; i < allOldSheets.length - 1; i++) {
      var target = allOldSheets[i];
      try {
        if (!dryRun) {
          ss.deleteSheet(target.sheet);
          Logger.log("SUCCESS: Deleted " + target.name);
        } else {
          Logger.log("DRY RUN: Would have deleted " + target.name);
        }
      } catch (e) {
        Logger.log(
          "ERROR: Could not delete " + target.name + ". Error: " + e.toString(),
        );
      }
    }

    // 4. Rename the most recent survivor to Week 00
    const newName = "RPT_Week_0_" + keepSheetObj.datePart;
    if (!dryRun) {
      keepSheetObj.sheet.setName(newName);
      Logger.log("RENAMED: " + keepSheetObj.name + " is now " + newName);
    } else {
      Logger.log(
        "DRY RUN: Would have renamed " + keepSheetObj.name + " to " + newName,
      );
    }
  } else {
    Logger.log(
      "No sheets found matching the pattern for any year prior to " +
        currentYear +
        ".",
    );
  }

  Logger.log("--- Cleanup Process Finished ---");
}
