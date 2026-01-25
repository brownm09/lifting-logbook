import { MSG_SUCCESS_TOAST } from "@src/api/constants/constants";
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
      const toastMsg = MSG_SUCCESS_TOAST(sheet.getName());
      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
    });
  }
}
