// Stubs for Google Sheets triggers

import { MenuController } from "@src/api/controllers";
import {
  CycleDashboardRepository,
  LiftingProgramSpecRepository,
  WorkoutRepository,
} from "@src/api/repositories";
import { findWorkoutRowsToHideOnEdit, updateLiftDates } from "@src/core";

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

  if (editedSheet === cycleSheetName) {
    const workoutRepo = new WorkoutRepository(editedSheet);
    const row = e.range.getRow();
    const col = e.range.getColumn();

    // Scan the entire sheet for the first cell with "Reps"
    const workoutData = workoutRepo.getWorkout();
    const rowsToHide: number[] = findWorkoutRowsToHideOnEdit(
      workoutData,
      row - 1,
      col - 1,
    );
    // Hide the identified rows
    // rowsToHide.forEach(r => workoutRepo.hideRow(r + 1));
    if (rowsToHide.length > 0) {
      workoutRepo.hideRows(rowsToHide.map((r) => r + 1));
    }

    // Check if the edited cell is a date
    if (e.range.getValue() && !isNaN(Date.parse(e.range.getValue()))) {
      const programSpecRepo = new LiftingProgramSpecRepository();
      const programSpec = programSpecRepo.getLiftingProgramSpec();
      const updatedWorkoutData = updateLiftDates(
        workoutData,
        programSpec,
        row - 1,
      );
      workoutRepo.setWorkout(updatedWorkoutData);
    }
  }
}
