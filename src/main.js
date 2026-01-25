// This has no bearing on Typescript; it's just the entry point for GAS functions that need global access
// These are visible to the GAS Editor dropdown
function onOpen(e) {
  api.onOpen(e);
}

function onEdit(e) {
  api.onEdit(e);
}

function startNewCycle() {
  new api.StartNewCycleAction().run();
}

function handleUpdateTrainingMaxes() {
  new api.UpdateTrainingMaxesAction().run();
}

// function handleRefreshWorkoutGrid() {
//   api.MenuController.handleRefreshWorkoutGrid();
// }

function handleFormatSheet() {
  new api.FormatSheetAction().run();
}

function handleFormatWorkoutSheet() {
  new api.FormatWorkoutSheetAction().run();
}
/* Navigation Handlers */
function handleNavToCurrentWorkout() {
  new api.NavToCurrentWorkoutAction().run();
}

import { SHEET_NAME_DASHBOARD, SHEET_NAME_TRAINING_MAXES, SHEET_NAME_PROGRAM_SPEC } from "./api/constants/constants";
function handleNavToDashboard() {
  new api.NavigationAction().run(SHEET_NAME_DASHBOARD);
}

function handleNavToMaxes() {
  new api.NavigationAction().run(SHEET_NAME_TRAINING_MAXES);
}

function handleNavToProgramSpec() {
  new api.NavigationAction().run(SHEET_NAME_PROGRAM_SPEC);
}
