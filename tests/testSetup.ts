import {
  createSheetMock,
  createSpreadsheetAppMock,
  createSpreadsheetMock,
} from "./gasMocks";

// Create a default global state
const defaultSheet = createSheetMock("Sheet1", [["Header"], ["Data"]]);
const ssMock = createSpreadsheetMock([defaultSheet]);

global.SpreadsheetApp = createSpreadsheetAppMock(ssMock) as any;

/*
jest.mock("@src/api/controllers", () => ({
}));

jest.mock("@src/api/repositories", () => ({
  SheetRepository: jest.fn().mockImplementation(() => ({
    createTableSheet: jest.fn(() => ({
      getName: () => "Sheet2",
      setFrozenRows: jest.fn(),
      autoResizeColumns: jest.fn(),
      getLastColumn: jest.fn(() => 5),
      getLastRow: jest.fn(() => 10),
    })),
  })),
  CycleDashboardRepository: jest.fn().mockImplementation(() => ({
    getCycleDashboard: jest.fn(() => ({ sheetName: "Sheet1" })),
    setCycleDashboard: jest.fn(),
  })),
  LiftingProgramSpecRepository: jest.fn().mockImplementation(() => ({
    getLiftingProgramSpec: jest.fn(() => ["spec"]),
    setLiftingProgramSpec: jest.fn(),
  })),
  TrainingMaxRepository: jest.fn().mockImplementation(() => ({
    getTrainingMaxes: jest.fn(() => ["max"]),
    setTrainingMaxes: jest.fn(),
  })),
  LiftRecordRepository: jest.fn().mockImplementation(() => ({
    appendLiftRecords: jest.fn(),
  })),
  WorkoutRepository: jest.fn().mockImplementation(() => ({
    getWorkout: jest.fn(() => ["workout"]),
    hideSheet: jest.fn(),
  })),
}));

jest.mock("@src/api/ui", () => ({
  cropSheet: jest.fn(),
  runWithErrorHandling: jest.fn(),
  WorkoutView: {
    formatWorkoutSheet: jest.fn(),
    headerifyRow: jest.fn(),
    highlightTodayRows: jest.fn(),
  },
}));

jest.mock("@src/core/constants", () => ({
}));

jest.mock("@src/core/models", () => ({
}));

jest.mock("@src/core/services", () => ({
  updateCycle: jest.fn(() => ()),
  updateMaxes: jest.fn(() => []),
  createGridV2: jest.fn(() => []),
  extractLiftRecords: jest.fn(() => []),
}));

jest.mock("@src/core/utils", () => ({
  parseCycleDashboard: jest.fn(() => ({})),
  parseLiftingProgramSpec: jest.fn(() => []),
  parseTrainingMaxes: jest.fn(() => []),
  parseLiftRecords: jest.fn(() => []),
  mapLiftRecords: jest.fn(() => [[""]]),
  mapCycleDashboard: jest.fn(() => [[""]]),
  mapLiftingProgramSpec: jest.fn(() => [[""]]),
  mapTrainingMaxes: jest.fn(() => [[""]]),
}));
*/
