import { MSG_ERROR_UNKNOWN, MSG_ERROR_ALERT_TITLE, MSG_ERROR_ALERT } from "@src/api/constants/constants";
/**
 * Wraps a function with a try/catch block to show errors in the Google Sheets UI.
 * This prevents silent failures and gives users actionable feedback.
 */
export function runWithErrorHandling(fn: () => void) {
  try {
    fn();
  } catch (e: any) {
    const ui = SpreadsheetApp.getUi();
    const message = e.message || MSG_ERROR_UNKNOWN;

    Logger.log(`Error: ${message} \nStack: ${e.stack}`);

    ui.alert(
      MSG_ERROR_ALERT_TITLE,
      MSG_ERROR_ALERT(message),
      ui.ButtonSet.OK,
    );
  }
}
