// Stubs for Google Sheets triggers

import { findWorkoutRowsToHideOnEdit } from "../../core";
import { WorkoutRepository } from "../repositories";
import { CycleDashboardRepository } from "../repositories/CycleDashboardRepository";
import { MenuController } from "./MenuController";

/**
 * Triggered when the spreadsheet is opened.
 */
export function onOpen(e?: GoogleAppsScript.Events.SheetsOnOpen) {
  MenuController.createMenu();
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
      row,
      col,
    );

    // Hide the identified rows
    // rowsToHide.forEach(r => workoutRepo.hideRow(r + 1));
    workoutRepo.hideRows(rowsToHide);
  }
}
