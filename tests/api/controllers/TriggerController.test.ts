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

  it("calls hideRows with rows from findWorkoutRowsToHideOnEdit if edited sheet is the cycle sheet", () => {
    getNameMock.mockReturnValue("CycleSheet");
    const range = {
      getSheet: getSheetMock,
      getRow: () => 5,
      getColumn: () => 3,
      getValue: () => "Not a date",
    };
    getWorkoutMock.mockReturnValue([
      ["Lift", "Set", "Reps", "Weight"],
      ["Squat", "Warm-up", 5, 100],
      ["Squat", "Working", 3, 120],
    ]);
    onEdit({ range } as any);
    expect(WorkoutRepository).toHaveBeenCalledWith("CycleSheet");
    expect(getWorkoutMock).toHaveBeenCalled();
    expect(findWorkoutRowsToHideOnEdit).toHaveBeenCalledWith(
      expect.any(Array),
      5,
      3,
    );
    expect(hideRowsMock).toHaveBeenCalledWith([2, 3]);
  });

  it("does not throw if findWorkoutRowsToHideOnEdit returns empty array", () => {
    getNameMock.mockReturnValue("CycleSheet");
    (findWorkoutRowsToHideOnEdit as jest.Mock).mockReturnValue([]);
    const range = {
      getSheet: getSheetMock,
      getRow: () => 2,
      getColumn: () => 2,
      getValue: () => "Not a date",
    };
    getWorkoutMock.mockReturnValue([
      ["Lift", "Set", "Reps", "Weight"],
      ["Squat", "Warm-up", 5, 100],
    ]);
    expect(() => onEdit({ range } as any)).not.toThrow();
    expect(hideRowsMock).not.toHaveBeenCalled();
  });

  it("calls updateLiftDates if edited cell is a date", () => {
    getNameMock.mockReturnValue("CycleSheet");
    const range = {
      getSheet: getSheetMock,
      getRow: () => 5,
      getColumn: () => 3,
      getValue: () => new Date("2024-06-01"),
    };
    getWorkoutMock.mockReturnValue([
      ["Lift", "Set", "Reps", "Lift Date"],
      ["Squat", "Warm-up", 5, new Date("2024-06-01")],
      ["Squat", "Working", 3, new Date("2024-06-01")],
    ]);
    (findWorkoutRowsToHideOnEdit as jest.Mock).mockReturnValue([]);
    onEdit({ range } as any);
    expect(WorkoutRepository).toHaveBeenCalledWith("CycleSheet");
    expect(getWorkoutMock).toHaveBeenCalled();
    expect(findWorkoutRowsToHideOnEdit).toHaveBeenCalledWith(
      expect.any(Array),
      5,
      3,
    );
    expect(hideRowsMock).not.toHaveBeenCalled();
    expect(updateLiftDates).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      5,
    );
    expect(setWorkoutMock).toHaveBeenCalledWith(expect.any(Array));
  });
});
