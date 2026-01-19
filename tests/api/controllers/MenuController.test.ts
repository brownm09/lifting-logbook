jest.mock("../../../src/api/ui/uiUtils", () => ({
  runWithErrorHandling: jest.fn((fn: any) => fn()),
}));

jest.mock("../../../src/api/utils", () => ({
  cropSheet: jest.fn(),
}));

// jest.mock("../../../src/api/repositories/SheetRepository", () => ({
//   createTableSheet: jest.fn(),
// }));

jest.mock("../../../src/core", () => ({
  extractLiftRecords: jest.fn(() => ["record"]),
  updateCycle: jest.fn(() => ({
    sheetName: "Sheet2",
    cycleStartDate: "2026-01-08",
  })),
  updateMaxes: jest.fn(() => ["max"]),
  createGridV2: jest.fn(() => []),
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

jest.mock("../../../src/api/repositories/SheetRepository", () => ({
  SheetRepository: jest.fn().mockImplementation(() => ({
    createTableSheet: jest.fn(() => ({ getName: () => "Sheet2" })),
  })),
}));
jest.mock("../../../src/api/repositories/CycleDashboardRepository", () => ({
  CycleDashboardRepository: jest.fn().mockImplementation(() => ({
    getCycleDashboard: jest.fn(() => ({ sheetName: "Sheet1" })),
    setCycleDashboard: jest.fn(),
  })),
}));
jest.mock("../../../src/api/repositories/LiftingProgramSpecRepository", () => ({
  LiftingProgramSpecRepository: jest.fn().mockImplementation(() => ({
    getLiftingProgramSpec: jest.fn(() => ["spec"]),
  })),
}));
jest.mock("../../../src/api/repositories/TrainingMaxRepository", () => ({
  TrainingMaxRepository: jest.fn().mockImplementation(() => ({
    getTrainingMaxes: jest.fn(() => ["max"]),
    setTrainingMaxes: jest.fn(),
  })),
}));
jest.mock("../../../src/api/repositories/LiftRecordRepository", () => ({
  LiftRecordRepository: jest.fn().mockImplementation(() => ({
    appendLiftRecords: jest.fn(),
  })),
}));
jest.mock("../../../src/api/repositories/WorkoutRepository", () => ({
  WorkoutRepository: jest.fn().mockImplementation(() => ({
    getWorkout: jest.fn(() => ["workout"]),
    hideSheet: jest.fn(),
  })),
}));

import * as core from "../../../src/core";

import { MenuController } from "../../../src/api/controllers/MenuController";
import { CycleDashboardRepository } from "../../../src/api/repositories/CycleDashboardRepository";
import { LiftingProgramSpecRepository } from "../../../src/api/repositories/LiftingProgramSpecRepository";
import { LiftRecordRepository } from "../../../src/api/repositories/LiftRecordRepository";
import { SheetRepository } from "../../../src/api/repositories/SheetRepository";
import { TrainingMaxRepository } from "../../../src/api/repositories/TrainingMaxRepository";
import { WorkoutRepository } from "../../../src/api/repositories/WorkoutRepository";
import { runWithErrorHandling } from "../../../src/api/ui/uiUtils";
import { cropSheet } from "../../../src/api/utils";
// import { createTableSheet } from "../../../src/api/repositories/SheetRepository";

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
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    // jest.spyOn(global.Logger, "log").mockImplementation(() => {});
    global.Logger = {
      log: jest.fn(),
    } as any;
  });

  beforeEach(() => {
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
    getActiveSheetMock = jest.fn(() => ({
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
    }));
    setActiveSheetMock = jest.fn();

    global.SpreadsheetApp = {
      getUi: getUiMock,
      getActiveSpreadsheet: jest.fn(() => ({
        toast: toastMock,
        setActiveSheet: setActiveSheetMock,
        getSheetByName: jest.fn(() => ({
          getName: getNameMock,
          getDataRange: jest.fn(() => ({
            getValues: jest.fn(() => []),
          })),
          getLastRow: getLastRowMock,
          getLastColumn: getLastColumnMock,
          getRange: jest.fn(() => ({
            setValues: jest.fn(),
          })),
          getMaxColumns: jest.fn(),
          getMaxRows: jest.fn(),
          hideSheet: jest.fn(),
        })),
      })),
      getActiveSheet: getActiveSheetMock,
      setActiveSheet: setActiveSheetMock,
    } as any;

    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should create the menu with correct items", () => {
    MenuController.createMenu();
    const ui = global.SpreadsheetApp.getUi();
    expect(ui.createMenu).toHaveBeenCalledWith("Logbook Tools");
    const menu = (ui.createMenu as jest.Mock).mock.results[0].value;
    expect(menu.addItem).toHaveBeenCalledWith(
      "Format Current Sheet",
      "handleFormatSheet",
    );
    expect(menu.addSeparator).toHaveBeenCalled();
    expect(menu.addItem).toHaveBeenCalledWith(
      "Start New Cycle",
      "startNewCycle",
    );
    expect(menu.addToUi).toHaveBeenCalled();
  });

  it("should call runWithErrorHandling when startNewCycle is called", () => {
    MenuController.startNewCycle();
    expect(runWithErrorHandling).toHaveBeenCalled();
  });

  it("should call runWithErrorHandling when handleFormatSheet is called", () => {
    MenuController.handleFormatSheet();
    expect(runWithErrorHandling).toHaveBeenCalled();
  });

  it("should format the current sheet and show a toast", () => {
    MenuController.handleFormatSheet();
    expect(autoResizeColumnsMock).toHaveBeenCalledWith(1, 5);
    expect(cropSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        autoResizeColumns: autoResizeColumnsMock,
      }),
    );
    expect(toastMock).toHaveBeenCalledWith(
      expect.stringContaining("formatted successfully."),
      "Success",
    );
  });

  it("should show an alert with error if cropSheet throws in handleFormatSheet", () => {
    (runWithErrorHandling as jest.Mock).mockImplementation((fn) => {
      const { runWithErrorHandling: realRunWithErrorHandling } =
        jest.requireActual("../../../src/api/ui/uiUtils");
      return realRunWithErrorHandling(fn);
    });
    (cropSheet as jest.Mock).mockImplementation(() => {
      throw new Error("fail");
    });
    MenuController.handleFormatSheet();
    expect(alertMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("fail"),
      expect.anything(),
    );
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("should call all repositories and core functions in startNewCycle", () => {
    jest
      .spyOn(core, "extractLiftRecords")
      .mockImplementation(() => ["record"] as any);
    jest.spyOn(core, "updateCycle").mockImplementation(
      () =>
        ({
          sheetName: "Sheet2",
          cycleStartDate: "2026-01-08",
        }) as any,
    );
    jest.spyOn(core, "updateMaxes").mockImplementation(() => ["max"] as any);
    jest.spyOn(core, "createGridV2").mockImplementation(() => []);

    MenuController.startNewCycle();

    expect(core.extractLiftRecords).toHaveBeenCalled();
    expect(core.updateCycle).toHaveBeenCalled();
    expect(core.updateMaxes).toHaveBeenCalled();
    expect(core.createGridV2).toHaveBeenCalled();
    expect(SheetRepository).toHaveBeenCalled();
    expect(CycleDashboardRepository).toHaveBeenCalled();
    expect(LiftingProgramSpecRepository).toHaveBeenCalled();
    expect(TrainingMaxRepository).toHaveBeenCalled();
    expect(LiftRecordRepository).toHaveBeenCalled();
    expect(WorkoutRepository).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.stringContaining("New cycle sheet"),
      "Success",
    );
    expect(setActiveSheetMock).toHaveBeenCalled();
  });

  it("should call alert with error if SheetRepository throws in startNewCycle", () => {
    (runWithErrorHandling as jest.Mock).mockImplementation((fn) => {
      const { runWithErrorHandling: realRunWithErrorHandling } =
        jest.requireActual("../../../src/api/ui/uiUtils");
      return realRunWithErrorHandling(fn);
    });
    (SheetRepository as jest.Mock).mockImplementation(() => ({
      createTableSheet: jest.fn((fn) => {
        throw new Error("fail");
      }),
    }));
    try {
      MenuController.startNewCycle();
    } catch (e) {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining("fail"));
    }
  });
});
