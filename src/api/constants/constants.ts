export const SHEET_NAME_DASHBOARD = "DASHBOARD";
export const SHEET_NAME_TRAINING_MAXES = "TRAINING_MAXES";
export const SHEET_NAME_PROGRAM_SPEC = "RPT_PROGRAM_SPEC";
export const SHEET_NAME_LIFT_RECORDS = "LIFT_RECORDS";

export const MENU_NAME_APP = "Logbook Tools";
export const MENU_NAME_NAVIGATION = "Navigate";

export const TIMEZONE = "GMT-5"; // Eastern Time
export const DISPLAY_DATE_FORMAT = "MM/dd/yyyy";
export const ISO_DATE_FORMAT = "yyyy-MM-dd";

export const MSG_ERROR_UNKNOWN = "An unknown error occurred.";
export const MSG_ERROR_SHEET_NOT_FOUND = (sheetName: string) =>
  `Sheet "${sheetName}" not found.`;
export const MSG_ERROR_ALERT_TITLE = "⚠️ Automation Error";
export const MSG_ERROR_ALERT = (message: string) =>
  `Something went wrong:\n\n${message}\n\nIf this persists, please contact the admin.`;
export const MSG_ERROR_LOG = (message: string, stack?: string) =>
  `Error: ${message} \nStack: ${stack}`;
export const MSG_ERROR_TOAST =
  "An error occurred. Check the console for details.";
export const MSG_ERROR_NAV_TO_WORKOUT = (sheetName: string, error: string) =>
  `Failed to navigate to Current Workout sheet "${sheetName}": ${error}`;
export const MSG_ERROR_NOT_WORKOUT_SHEET = (sheetName: string) =>
  `Sheet "${sheetName}" does not appear to be a workout sheet.`;

export const MSG_SUCCESS_TOAST = (sheetName: string) =>
  `Sheet "${sheetName}" formatted successfully.`;
export const MSG_SUCCESS_TOAST_WORKOUT = (sheetName: string) =>
  `Workout sheet "${sheetName}" formatted successfully.`;
export const MSG_SUCCESS_TOAST_UPDATED_MAXES = `Training maxes updated successfully.`;
export const MSG_SUCCESS_TOAST_NEW_CYCLE = (
  sheetName: string,
  newRecCt: number,
) =>
  `New cycle sheet "${sheetName}" created.` +
  `\nSuccessfully recorded ${newRecCt} lift records.` +
  `\nTraining maxes updated.` +
  `\nDashboard updated.`;

export const FORMULA_HYPERLINK_SHEET = (
  url: string,
  workoutSheetId: number,
  sheetName: string,
) => `=HYPERLINK("${url}#gid=${workoutSheetId}", "${sheetName}")`;

// Google Sheets default highlight color (light yellow)
export const WORKOUT_HIGHLIGHT_COLOR = "#82ee88";
