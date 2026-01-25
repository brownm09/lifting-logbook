jest.mock("@src/api/repositories", () => ({
  ...jest.requireActual("@src/api/repositories"),
  WorkoutRepository: jest.fn(),
}));

jest.mock("@src/api/ui", () => ({
  ...jest.requireActual("@src/api/ui"),
  WorkoutView: {
    formatWorkoutSheet: jest.fn(),
  },
  runWithErrorHandling: jest.fn(),
}));

import { FormatWorkoutSheetAction } from "@src/api/controllers";
import { WorkoutRepository } from "@src/api/repositories";
import { WorkoutView } from "@src/api/ui";
import {
  createRangeMock,
  createSheetMock,
  createSpreadsheetMock,
} from "@tests/gasMocks";
import { setupRunWithErrorHandling } from "@tests/testUtils";

describe("FormatWorkoutSheetAction", () => {
  const mockSheet = createSheetMock("RPT_2026_Cycle_1_20260101", [
    ["Header"],
    ["Data"],
  ]);
  const ssMock = createSpreadsheetMock([mockSheet]);
  const mockRange = createRangeMock();
  let toastSpy: jest.SpyInstance;

  beforeEach(() => {
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
      getActiveSheet: jest.fn().mockReturnValue(mockSheet as any),
    } as any;
    toastSpy = jest.spyOn(ssMock, "toast").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe("run", () => {
    it("should format the workout sheet", () => {
      setupRunWithErrorHandling(true);
      (WorkoutRepository as jest.Mock).mockReturnValue({
        getWorkout: jest.fn(() => ["workout"]),
      });
      new FormatWorkoutSheetAction().run();
      expect(WorkoutView.formatWorkoutSheet).toHaveBeenCalledWith(
        ["workout"],
        expect.anything(),
      );
      expect(toastSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Workout sheet "RPT_2026_Cycle_1_20260101" formatted successfully.',
        ),
        "Success",
      );
    });

    it("should throw an error", () => {
      setupRunWithErrorHandling(true);
      (mockSheet.getName as jest.Mock).mockReturnValue("Non_workout_sheet");
      expect(() => new FormatWorkoutSheetAction().run()).toThrow(
        'Sheet "Non_workout_sheet" does not appear to be a workout sheet.',
      );
      expect(WorkoutView.formatWorkoutSheet).not.toHaveBeenCalled();
      expect(toastSpy).not.toHaveBeenCalled();
    });
  });
});
