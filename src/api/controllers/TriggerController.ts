// Stubs for Google Sheets triggers

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
  // TODO: Implement onEdit logic
}
