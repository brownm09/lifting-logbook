import { WorkoutRepository } from "../../../src/api/repositories/WorkoutRepository";
import { cropSheet } from "../../../src/api/utils/cropSheet";

jest.mock("../../../src/api/utils/cropSheet", () => ({
  cropSheet: jest.fn(),
}));

describe("WorkoutRepository", () => {
  let sheetMock: any;
  let ssMock: any;
  let getDataRangeMock: jest.Mock;
  let getValuesMock: jest.Mock;
  let getRangeMock: jest.Mock;
  let setValuesMock: jest.Mock;
  let hideSheetMock: jest.Mock;

  beforeEach(() => {
    setValuesMock = jest.fn();
    getRangeMock = jest.fn(() => ({
      setValues: setValuesMock,
    }));
    getValuesMock = jest.fn();
    getDataRangeMock = jest.fn(() => ({
      getValues: getValuesMock,
    }));
    hideSheetMock = jest.fn();

    sheetMock = {
      getDataRange: getDataRangeMock,
      getRange: getRangeMock,
      hideSheet: hideSheetMock,
    };

    ssMock = {
      getSheetByName: jest.fn((name) => (name === "Workout" ? sheetMock : undefined)),
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("throws if sheet does not exist", () => {
    ssMock.getSheetByName.mockReturnValue(undefined);
    expect(() => new WorkoutRepository("MissingSheet")).toThrow("Sheet MissingSheet not found");
  });

  it("hides the workout sheet", () => {
    const repo = new WorkoutRepository("Workout");
    repo.hideSheet();
    expect(hideSheetMock).toHaveBeenCalled();
  });

  it("gets workout data including header row", () => {
    const data = [[1, 2], [3, 4]];
    getValuesMock.mockReturnValue(data);
    const repo = new WorkoutRepository("Workout");
    const result = repo.getWorkout();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getValuesMock).toHaveBeenCalled();
    expect(result).toEqual(data);
  });

  it("sets workout data and trims sheet", () => {
    const repo = new WorkoutRepository("Workout");
    const data = [[1, 2], [3, 4]];
    repo.setWorkout(data);
    expect(getRangeMock).toHaveBeenCalledWith(1, 1, data.length, data[0].length);
    expect(setValuesMock).toHaveBeenCalledWith(data);
    expect(cropSheet).toHaveBeenCalledWith(sheetMock);
  });

  it("throws if setValues fails", () => {
    setValuesMock.mockImplementation(() => { throw new Error("fail"); });
    const repo = new WorkoutRepository("Workout");
    const data = [[1, 2]];
    expect(() => repo.setWorkout(data)).toThrow("fail");
  });
});