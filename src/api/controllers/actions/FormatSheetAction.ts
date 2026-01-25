import { cropSheet, runWithErrorHandling } from "@src/api/ui";

export class FormatSheetAction {
  /**
   * Route: Logic for cleaning/formatting
   */
  run() {
    runWithErrorHandling(() => {
      const sheet = SpreadsheetApp.getActiveSheet();
      sheet.autoResizeColumns(1, sheet.getLastColumn());
      cropSheet(sheet);
      const toastMsg = `Sheet "${sheet.getName()}" formatted successfully.`;
      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
    });
  }
}
