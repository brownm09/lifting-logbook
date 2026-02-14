// Stubs for Google Sheets triggers

import { MenuController } from "@src/api/controllers";
import {
  CycleDashboardRepository,
  LiftingProgramSpecRepository,
  WorkoutRepository,
} from "@src/api/repositories";
import {
  calculateLiftWeights,
  findWorkoutRowsToHideOnEdit,
  LIFT_DATE_HEADER,
  NOTES_HEADER,
  REPS_HEADER,
  updateLiftDates,
  WEIGHT_HEADER,
} from "@src/core";

/**
 * Triggered when the spreadsheet is opened.
 */
export function onOpen(e?: GoogleAppsScript.Events.SheetsOnOpen) {
  MenuController.createToolsMenu();
  // MenuController.createNavMenu();
}

/**
 * Triggered when a cell is edited.
 */
export function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit) {
  if (!e || !e.range) return;

  // Get the edited sheet name
  const sheet = e.range.getSheet();
  const editedSheet = sheet.getName();

  // Get the cycle sheet name from the dashboard
  const dashboardRepo = new CycleDashboardRepository();
  const dashboard = dashboardRepo.getCycleDashboard();
  const cycleSheetName = dashboard.sheetName;

  // console.log(e);

  const rowIdx = e.range.getRow();
  const colIdx = e.range.getColumn();

  console.log(`Edited sheet: ${editedSheet}, row: ${rowIdx}, col: ${colIdx}`);

  if (editedSheet === cycleSheetName) {
    const workoutRepo = new WorkoutRepository(editedSheet);
    const programSpecRepo = new LiftingProgramSpecRepository();
    const programSpec = programSpecRepo.getLiftingProgramSpec();
    const workoutData = workoutRepo.getWorkout();
    const metaHeaderRowIdx = workoutData.findIndex((row) =>
      row.includes(LIFT_DATE_HEADER),
    );
    const entryHeaderRowIdx = workoutData.findIndex((row) =>
      row.includes(NOTES_HEADER),
    );

    if (metaHeaderRowIdx === -1) {
      console.warn(
        `Meta header row with ${LIFT_DATE_HEADER} not found. Skipping onEdit processing.`,
      );
      return;
    }
    if (entryHeaderRowIdx === -1) {
      console.warn(
        `Entry header row with ${NOTES_HEADER} not found. Skipping onEdit processing.`,
      );
      return;
    }
    console.log(
      `Meta header row index: ${metaHeaderRowIdx}, Entry header row index: ${entryHeaderRowIdx}.`,
    );
    if (rowIdx - 1 > entryHeaderRowIdx) {
      if (workoutData[entryHeaderRowIdx][colIdx - 1] === REPS_HEADER) {
        const rowsToHide: number[] = findWorkoutRowsToHideOnEdit(
          workoutData,
          rowIdx - 1,
          colIdx - 1,
        );
        // Hide the identified rows
        // rowsToHide.forEach(r => workoutRepo.hideRow(r + 1));
        if (rowsToHide.length > 0) {
          workoutRepo.hideRows(rowsToHide.map((r) => r + 1));
        }
      }
    } else {
      if (workoutData[metaHeaderRowIdx][colIdx - 1] === LIFT_DATE_HEADER) {
        if (e.range.getValue() && !isNaN(Date.parse(e.range.getValue()))) {
          // If the edited cell is a date, update lift dates for lifts with the same offset
          const updatedWorkoutData = updateLiftDates(
            workoutData,
            programSpec,
            rowIdx - 1,
            colIdx - 1,
          );
          workoutRepo.setWorkout(updatedWorkoutData);
        }
      }
      if (workoutData[metaHeaderRowIdx][colIdx - 1] === WEIGHT_HEADER) {
        if (e.range.getValue() && !isNaN(parseInt(e.range.getValue()))) {
          // If the edited cell is a number, recalculate lift weights
          const updatedWorkoutData = calculateLiftWeights(
            workoutData,
            programSpec,
            rowIdx - 1,
            colIdx - 1,
          );
          workoutRepo.setWorkout(updatedWorkoutData);
        }
      }
    }
  }
}
