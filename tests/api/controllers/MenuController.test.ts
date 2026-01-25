jest.mock("@src/api/ui", () => ({
  runWithErrorHandling: jest.fn(),
  cropSheet: jest.fn(),
  WorkoutView: {
    formatWorkoutSheet: jest.fn(),
    headerifyRow: jest.fn(),
    highlightTodayRows: jest.fn(),
  },
}));

jest.mock("@src/core/services", () => ({
  extractLiftRecords: jest.fn(() => ["record"]),
  updateCycle: jest.fn(() => ({
    sheetName: "Sheet2",
    cycleStartDate: "2026-01-08",
  })),
  updateMaxes: jest.fn(() => ["max"]),
  createGridV2: jest.fn(() => []),
}));
jest.mock("@src/core/utils", () => ({
  parseCycleDashboard: jest.fn(() => ({
    sheetName: "Sheet1",
  })),
  parseLiftingProgramSpec: jest.fn(),
  parseTrainingMaxes: jest.fn(),
  parseLiftRecords: jest.fn(),
  mapLiftRecords: jest.fn(() => [[""]]),
  mapCycleDashboard: jest.fn(() => [[""]]),
  mapLiftingProgramSpec: jest.fn(() => [[""]]),
  mapTrainingMaxes: jest.fn(() => [[""]]),
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

import { MenuController } from "@src/api/controllers";
// import { createTableSheet } from "@src/api";

describe("MenuController", () => {
  let alertMock: jest.Mock = jest.fn();
  let addItemMock: jest.Mock;
  let addSeparatorMock: jest.Mock;
  let addToUiMock: jest.Mock;
  let createMenuMock: jest.Mock;
  let getUiMock: jest.Mock;
  let toastMock: jest.Mock;
  let autoResizeColumnsMock: jest.Mock;
  let getLastRowMock: jest.Mock;
  let getLastColumnMock: jest.Mock;
  let getNameMock: jest.Mock;
  let getActiveSheetMock: jest.Mock;
  let setActiveSheetMock: jest.Mock;
  let getRangeMock: jest.Mock;
  let setFrozenRowsMock: jest.Mock;
  let sheetMock: jest.Mock;

  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    // jest.spyOn(global.Logger, "log").mockImplementation(() => {});
    global.Logger = {
      log: jest.fn(),
    } as any;
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    addItemMock = jest.fn().mockReturnThis();
    addSeparatorMock = jest.fn().mockReturnThis();
    addToUiMock = jest.fn();
    alertMock.mockClear();
    createMenuMock = jest.fn(() => ({
      addItem: addItemMock,
      addSeparator: addSeparatorMock,
      addToUi: addToUiMock,
    }));
    getUiMock = jest.fn(() => ({
      createMenu: createMenuMock,
      ButtonSet: { OK: "OK" },
      alert: alertMock,
    }));
    getRangeMock = jest.fn();
    getLastRowMock = jest.fn();
    getLastColumnMock = jest.fn();
    toastMock = jest.fn();
    autoResizeColumnsMock = jest.fn();
    getLastColumnMock = jest.fn(() => 5);
    getNameMock = jest.fn(() => "Sheet1");
    setFrozenRowsMock = jest.fn();

    sheetMock = {
      autoResizeColumns: autoResizeColumnsMock,
      getLastColumn: getLastColumnMock,
      getName: getNameMock,
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => []),
      })),
      getLastRow: getLastRowMock,
      getRange: getRangeMock,
      getMaxColumns: jest.fn(),
      getMaxRows: jest.fn(),
      hideSheet: jest.fn(),
      setFrozenRows: setFrozenRowsMock,
    } as any;

    getActiveSheetMock = jest.fn(() => sheetMock);
    setActiveSheetMock = jest.fn();

    global.SpreadsheetApp = {
      getUi: getUiMock,
      getActiveSpreadsheet: jest.fn(() => ({
        toast: toastMock,
        setActiveSheet: setActiveSheetMock,
        getSheetByName: jest.fn(() => sheetMock),
      })),
      getActiveSheet: getActiveSheetMock,
      setActiveSheet: setActiveSheetMock,
    } as any;
  });

  describe("createToolsMenu", () => {
    it("should create the menu with correct items", () => {
      MenuController.createToolsMenu();
      const ui = global.SpreadsheetApp.getUi();
      expect(ui.createMenu).toHaveBeenCalledWith("Logbook Tools");
      const menu = (ui.createMenu as jest.Mock).mock.results[0].value;
      expect(menu.addItem).toHaveBeenCalledWith(
        "Format Current Sheet",
        "handleFormatSheet",
      );
      expect(menu.addItem).toHaveBeenCalledWith(
        "Format Current Workout Sheet",
        "handleFormatWorkoutSheet",
      );
      expect(menu.addSeparator).toHaveBeenCalled();
      expect(menu.addItem).toHaveBeenCalledWith(
        "Start New Cycle",
        "startNewCycle",
      );
      expect(menu.addToUi).toHaveBeenCalled();
    });
  });

  describe("createNavMenu", () => {
    it("should create the menu with correct items", () => {
      MenuController.createNavMenu();
      const ui = global.SpreadsheetApp.getUi();
      expect(ui.createMenu).toHaveBeenCalledWith("Logbook Navigation");
      const menu = (ui.createMenu as jest.Mock).mock.results[0].value;
      expect(menu.addItem).toHaveBeenCalledWith(
        "Cycle Dashboard",
        "handleNavToDashboard",
      );
      expect(menu.addItem).toHaveBeenCalledWith(
        "Training Maxes",
        "handleNavToMaxes",
      );
      expect(menu.addItem).toHaveBeenCalledWith(
        "Program Spec",
        "handleNavToProgramSpec",
      );
      expect(menu.addItem).toHaveBeenCalledWith(
        "Current Workout",
        "handleNavToCurrentWorkout",
      );
      expect(menu.addToUi).toHaveBeenCalled();
      expect(menu.addSeparator).not.toHaveBeenCalled();
    });
  });

  // describe("runWithErrorHandling", () => {
  //   it("should call runWithErrorHandling when startNewCycle is called", () => {
  //     MenuController.startNewCycle();
  //     expect(runWithErrorHandling).toHaveBeenCalled();
  //   });

  //   it("should call runWithErrorHandling when handleFormatWorkoutSheet is called", () => {
  //     MenuController.handleFormatWorkoutSheet();
  //     expect(runWithErrorHandling).toHaveBeenCalled();
  //   });
  // });
});
