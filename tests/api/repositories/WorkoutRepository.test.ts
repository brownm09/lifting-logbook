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
  let getLastRowMock: jest.Mock;
  let getLastColumnMock: jest.Mock;
  let getConditionalFormatRulesMock: jest.Mock;
  let setConditionalFormatRulesMock: jest.Mock;

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
    getLastRowMock = jest.fn(() => 5);
    getLastColumnMock = jest.fn(() => 3);
    getConditionalFormatRulesMock = jest.fn(() => []);
    setConditionalFormatRulesMock = jest.fn();

    sheetMock = {
      getDataRange: getDataRangeMock,
      getRange: getRangeMock,
      hideSheet: hideSheetMock,
      getLastRow: getLastRowMock,
      getLastColumn: getLastColumnMock,
      getConditionalFormatRules: getConditionalFormatRulesMock,
      setConditionalFormatRules: setConditionalFormatRulesMock,
    };

    ssMock = {
      getSheetByName: jest.fn((name) =>
        name === "Workout" ? sheetMock : undefined,
      ),
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
    } as any;

    (global.SpreadsheetApp as any).newConditionalFormatRule = jest.fn(() => ({
      whenFormulaSatisfied: jest.fn().mockReturnThis(),
      setBackground: jest.fn().mockReturnThis(),
      setRanges: jest.fn().mockReturnThis(),
      build: jest.fn(() => "rule"),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("throws if sheet does not exist", () => {
    ssMock.getSheetByName.mockReturnValue(undefined);
    expect(() => new WorkoutRepository("MissingSheet")).toThrow(
      "Sheet MissingSheet not found",
    );
  });

  it("hides the workout sheet", () => {
    const repo = new WorkoutRepository("Workout");
    repo.hideSheet();
    expect(hideSheetMock).toHaveBeenCalled();
  });

  it("gets workout data including header row", () => {
    const data = [
      [1, 2],
      [3, 4],
    ];
    getValuesMock.mockReturnValue(data);
    const repo = new WorkoutRepository("Workout");
    const result = repo.getWorkout();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getValuesMock).toHaveBeenCalled();
    expect(result).toEqual(data);
  });

  it("sets workout data and trims sheet", () => {
    const repo = new WorkoutRepository("Workout");
    const data = [
      [1, 2],
      [3, 4],
    ];
    repo.setWorkout(data);
    expect(getRangeMock).toHaveBeenCalledWith(
      1,
      1,
      data.length,
      data[0].length,
    );
    expect(setValuesMock).toHaveBeenCalledWith(data);
    expect(cropSheet).toHaveBeenCalledWith(sheetMock);
  });

  it("throws if setValues fails", () => {
    setValuesMock.mockImplementation(() => {
      throw new Error("fail");
    });
    const repo = new WorkoutRepository("Workout");
    const data = [[1, 2]];
    expect(() => repo.setWorkout(data)).toThrow("fail");
  });

  it("adds conditional formatting to highlight today's date in the specified column", () => {
    const repo = new WorkoutRepository("Workout");
    repo.addTodayHighlightConditionalFormat(2); // e.g., column B
    expect(getConditionalFormatRulesMock).toHaveBeenCalled();
    expect(global.SpreadsheetApp.newConditionalFormatRule).toHaveBeenCalled();
    expect(setConditionalFormatRulesMock).toHaveBeenCalledWith(
      expect.arrayContaining(["rule"]),
    );
  });

  it("does not add conditional formatting if there are no data rows", () => {
    getLastRowMock.mockReturnValue(1); // Only header
    const repo = new WorkoutRepository("Workout");
    repo.addTodayHighlightConditionalFormat(2);
    expect(setConditionalFormatRulesMock).not.toHaveBeenCalled();
  });
});
