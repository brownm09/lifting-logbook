/**
 * Wraps a function with a try/catch block to show errors in the Google Sheets UI.
 * This prevents silent failures and gives users actionable feedback.
 */
export function runWithErrorHandling(fn: () => void) {
  try {
    fn();
  } catch (e: any) {
    const ui = SpreadsheetApp.getUi();
    const message = e.message || "An unknown error occurred.";

    Logger.log(`Error: ${message} \nStack: ${e.stack}`);

    ui.alert(
      "⚠️ Automation Error",
      `Something went wrong:\n\n${message}\n\nIf this persists, please contact the admin.`,
      ui.ButtonSet.OK,
    );
  }
}
