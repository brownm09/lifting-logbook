import { onEdit } from "@src/api/controllers";
import {
  CycleDashboardRepository,
  WorkoutRepository,
} from "@src/api/repositories";
import { findWorkoutRowsToHideOnEdit } from "@src/core";

jest.mock("@src/api/repositories/WorkoutRepository");
jest.mock("@src/api/repositories/CycleDashboardRepository");
jest.mock("@src/core", () => ({
  findWorkoutRowsToHideOnEdit: jest.fn(),
}));

describe("onEdit", () => {
  let getSheetMock: jest.Mock;
  let getNameMock: jest.Mock;
  let getWorkoutMock: jest.Mock;
  let hideRowsMock: jest.Mock;

  beforeEach(() => {
    getNameMock = jest.fn();
    getSheetMock = jest.fn(() => ({
      getName: getNameMock,
    }));
    getWorkoutMock = jest.fn();
    hideRowsMock = jest.fn();

    (WorkoutRepository as jest.Mock).mockImplementation(() => ({
      getWorkout: getWorkoutMock,
      hideRows: hideRowsMock,
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
    };
    getWorkoutMock.mockReturnValue([
      ["Lift", "Set", "Reps", "Weight"],
      ["Squat", "Warm-up", 5, 100],
    ]);
    expect(() => onEdit({ range } as any)).not.toThrow();
    expect(hideRowsMock).toHaveBeenCalledWith([]);
  });
});
