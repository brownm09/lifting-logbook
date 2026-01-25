jest.mock("@src/api/repositories", () => ({
  ...jest.requireActual("@src/api/repositories"),
  CycleDashboardRepository: jest.fn().mockImplementation(() => ({
    getCycleDashboard: jest.fn().mockReturnValue({ sheetName: "Sheet1" }),
    setCycleDashboard: jest.fn(),
  })),
  LiftingProgramSpecRepository: jest.fn().mockImplementation(() => ({
    getLiftingProgramSpec: jest.fn(),
    setLiftingProgramSpec: jest.fn(),
  })),
  TrainingMaxRepository: jest.fn().mockImplementation(() => ({
    getTrainingMaxes: jest.fn(),
    setTrainingMaxes: jest.fn(),
  })),
  LiftRecordRepository: jest.fn().mockImplementation(() => ({
    appendLiftRecords: jest.fn(),
  })),
  WorkoutRepository: jest.fn().mockImplementation(() => ({
    getWorkout: jest.fn(),
    hideSheet: jest.fn(),
  })),
}));

jest.mock("@src/api/ui", () => ({
  ...jest.requireActual("@src/api/ui"),
  runWithErrorHandling: jest.fn(),
}));

jest.mock("@src/core/services", () => ({
  ...jest.requireActual("@src/core/services"),
  extractLiftRecords: jest.fn().mockReturnValue([]),
  updateCycle: jest.fn().mockReturnValue(() => ({
    sheetName: "Sheet1",
    cycleDate: new Date("2026-01-01"),
  })),
  updateMaxes: jest.fn().mockReturnValue([]),
  createGridV2: jest.fn().mockReturnValue([]),
}));

import { UpdateTrainingMaxesAction } from "@src/api/controllers";
import * as repositories from "@src/api/repositories";
import * as coreServices from "@src/core/services";
import {
  createRangeMock,
  createSheetMock,
  createSpreadsheetAppMock,
  createSpreadsheetMock,
} from "@tests/gasMocks";
import { setupRunWithErrorHandling } from "@tests/testUtils";

describe("UpdateTrainingMaxesAction", () => {
  const mockRange = createRangeMock();
  const mockSheet = createSheetMock("RPT_2026_Cycle_1_20260101", [
    ["Header"],
    ["Data"],
  ]);
  const ssMock = createSpreadsheetMock([mockSheet]);
  const ssAppMock = createSpreadsheetAppMock(ssMock);
  let toastSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;
  global.SpreadsheetApp = ssAppMock as any;
  global.Logger = {
    log: jest.fn(),
  } as any;

  beforeEach(() => {
    toastSpy = jest.spyOn(ssMock, "toast").mockImplementation(() => {});
    alertSpy = jest
      .spyOn(ssAppMock.getUi(), "alert")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe("run", () => {
    it("should call all repositories and core functions in startNewCycle", () => {
      setupRunWithErrorHandling(true);
      new UpdateTrainingMaxesAction().run();

      expect(coreServices.extractLiftRecords).toHaveBeenCalled();
      expect(coreServices.updateMaxes).toHaveBeenCalled();
      expect(repositories.CycleDashboardRepository).toHaveBeenCalled();
      expect(repositories.LiftingProgramSpecRepository).toHaveBeenCalled();
      expect(repositories.TrainingMaxRepository).toHaveBeenCalled();
      expect(repositories.LiftRecordRepository).toHaveBeenCalled();
      expect(repositories.WorkoutRepository).toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith(
        expect.stringContaining("Training maxes updated successfully."),
        "Success",
      );
    });
  });
});
