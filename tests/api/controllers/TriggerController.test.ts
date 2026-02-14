import { onEdit } from "@src/api/controllers";
import {
  CycleDashboardRepository,
  LiftingProgramSpecRepository,
  WorkoutRepository,
} from "@src/api/repositories";
import { findWorkoutRowsToHideOnEdit, updateLiftDates } from "@src/core";

jest.mock("@src/api/repositories/WorkoutRepository");
jest.mock("@src/api/repositories/LiftingProgramSpecRepository");
jest.mock("@src/api/repositories/CycleDashboardRepository");
jest.mock("@src/core", () => ({
  findWorkoutRowsToHideOnEdit: jest.fn(),
  updateLiftDates: jest.fn().mockReturnValue([]),
  calculateLiftWeights: jest.fn().mockReturnValue([]),
  LIFT_DATE_HEADER: "Lift Date",
  NOTES_HEADER: "Notes",
  REPS_HEADER: "Reps",
  WEIGHT_HEADER: "Weight",
}));

describe("onEdit", () => {
  let getSheetMock: jest.Mock;
  let getNameMock: jest.Mock;
  let getWorkoutMock: jest.Mock;
  let hideRowsMock: jest.Mock;
  let setWorkoutMock: jest.Mock;
  beforeEach(() => {
    getNameMock = jest.fn();
    getSheetMock = jest.fn(() => ({
      getName: getNameMock,
    }));
    getWorkoutMock = jest.fn();
    hideRowsMock = jest.fn();
    setWorkoutMock = jest.fn();

    (WorkoutRepository as jest.Mock).mockImplementation(() => ({
      getWorkout: getWorkoutMock,
      hideRows: hideRowsMock,
      setWorkout: setWorkoutMock,
    }));

    (LiftingProgramSpecRepository as jest.Mock).mockImplementation(() => ({
      getLiftingProgramSpec: jest.fn().mockReturnValue([]),
    }));

    (CycleDashboardRepository as jest.Mock).mockImplementation(() => ({
      getCycleDashboard: jest.fn(() => ({
        sheetName: "CycleSheet",
      })),
    }));

    (findWorkoutRowsToHideOnEdit as jest.Mock).mockReturnValue([2, 3]);

    getWorkoutMock.mockReturnValue([
      ["Core Lift", "Scheme", "Lift Date", "Weight"],
      ["Squat", "3 × 10", new Date("2024-06-01"), 120],
      ["Lift", "Set", "Reps", "Weight", "Notes"],
      ["Squat", "Warm-up", 5, 100, ""],
      ["Squat", "Set 1", 3, 120, ""],
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing if event or range is missing", () => {
    expect(() => onEdit(undefined as any)).not.toThrow();
    expect(() => onEdit({} as any)).not.toThrow();
  });

  it("does nothing if edited sheet is not the cycle sheet", () => {
    getNameMock.mockReturnValue("OtherSheet");
    const range = {
      getSheet: getSheetMock,
      getRow: () => 1,
      getColumn: () => 1,
    };
    onEdit({ range } as any);
    expect(WorkoutRepository).not.toHaveBeenCalled();
  });

  it("calls findWorkoutRowsToHideOnEdit", () => {
    getNameMock.mockReturnValue("CycleSheet");
    const range = {
      getSheet: getSheetMock,
      getRow: () => 5,
      getColumn: () => 3,
      getValue: () => 0,
    };

    onEdit({ range } as any);
    expect(WorkoutRepository).toHaveBeenCalledWith("CycleSheet");
    expect(getWorkoutMock).toHaveBeenCalled();
    expect(findWorkoutRowsToHideOnEdit).toHaveBeenCalledWith(
      expect.any(Array),
      4,
      2,
    );
    expect(hideRowsMock).toHaveBeenCalledWith([3, 4]);
  });

  it("calls updateLiftDates if edited cell is a date", () => {
    getNameMock.mockReturnValue("CycleSheet");
    const range = {
      getSheet: getSheetMock,
      getRow: () => 2,
      getColumn: () => 3,
      getValue: () => new Date(2024, 5, 3),
    };
    (findWorkoutRowsToHideOnEdit as jest.Mock).mockReturnValue([]);
    onEdit({ range } as any);
    expect(WorkoutRepository).toHaveBeenCalledWith("CycleSheet");
    expect(getWorkoutMock).toHaveBeenCalled();
    expect(hideRowsMock).not.toHaveBeenCalled();
    expect(updateLiftDates).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      1,
      2,
    );
    expect(setWorkoutMock).toHaveBeenCalledWith(expect.any(Array));
  });
});
