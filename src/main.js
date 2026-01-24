// This has no bearing on Typescript; it's just the entry point for GAS functions that need global access
// These are visible to the GAS Editor dropdown
function onOpen(e) {
  api.onOpen(e);
}

function onEdit(e) {
  api.onEdit(e);
}

function startNewCycle() {
  api.MenuController.startNewCycle();
}

function handleUpdateTrainingMaxes() {
  api.MenuController.handleUpdateTrainingMaxes();
}

// function handleRefreshWorkoutGrid() {
//   api.MenuController.handleRefreshWorkoutGrid();
// }

function handleFormatSheet() {
  api.MenuController.handleFormatSheet();
}

function handleFormatWorkoutSheet() {
  api.MenuController.handleFormatWorkoutSheet();
}
