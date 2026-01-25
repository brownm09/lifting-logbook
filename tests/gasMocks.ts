// tests/mocks/GasMocks.js

export const createRangeMock = (initialValues = [[]]) => ({
  getValues: jest.fn().mockReturnValue(initialValues),
  setValues: jest.fn().mockReturnThis(),
  setValue: jest.fn().mockReturnThis(),
  setBackground: jest.fn().mockReturnThis(),
  getLastRow: jest.fn().mockReturnValue(initialValues.length),
  getLastColumn: jest.fn().mockReturnValue(initialValues[0].length),
});

export const createSheetMock = (name = "MockSheet", values = [[]]) => {
  const rangeMock = createRangeMock(values);
  return {
    getName: jest.fn().mockReturnValue(name),
    getRange: jest.fn().mockReturnValue(rangeMock),
    getLastRow: jest.fn().mockReturnValue(values.length),
    getLastColumn: jest.fn().mockReturnValue(values[0].length),
    appendRow: jest.fn().mockReturnThis(),
    clear: jest.fn().mockReturnThis(),
    autoResizeColumns: jest.fn().mockReturnThis(),
    setFrozenRows: jest.fn().mockReturnThis(),
    getDataRange: jest.fn().mockReturnValue(rangeMock),
  };
};

export const createSpreadsheetMock = (sheets = []) => ({
  getSheetByName: jest.fn(
    (name) => sheets.find((s) => s.getName() === name) || null,
  ),
  getSheets: jest.fn().mockReturnValue(sheets),
  toast: jest.fn(),
  getId: jest.fn().mockReturnValue("mock-id-123"),
});

export const createSpreadsheetAppMock = (activeSheet = null, url = "") => ({
  getActiveSpreadsheet: jest.fn(() => activeSheet),
  setActiveSheet: jest.fn(),
  // getActiveSheet: jest.fn().mockReturnValue(defaultSheet),
  getUi: jest.fn(() => ({
    alert: jest.fn(() => {}),
    showModalDialog: jest.fn(),
    createMenu: jest.fn().mockReturnThis(),
    addItem: jest.fn().mockReturnThis(),
    addToUi: jest.fn(),
    ButtonSet: { OK: "OK" },
  })),
});

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
