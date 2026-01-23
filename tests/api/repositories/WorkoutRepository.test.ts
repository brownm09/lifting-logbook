import { WorkoutRepository } from "../../../src/api/repositories/WorkoutRepository";

jest.mock("../../../src/api/utils/cropSheet", () => ({
  cropSheet: jest.fn(),
}));

describe("WorkoutRepository", () => {
  let sheetMock: any;
  let ssMock: any;
  let getDataRangeMock: jest.Mock;
  let getDisplayValuesMock: jest.Mock;
  let getRangeMock: jest.Mock;
  let setValuesMock: jest.Mock;
  let hideSheetMock: jest.Mock;
  let hideRowsMock: jest.Mock;
  let getLastRowMock: jest.Mock;
  let getLastColumnMock: jest.Mock;
  let getConditionalFormatRulesMock: jest.Mock;
  let setConditionalFormatRulesMock: jest.Mock;

  beforeEach(() => {
    setValuesMock = jest.fn();
    getRangeMock = jest.fn(() => ({
      setValues: setValuesMock,
    }));
    getDisplayValuesMock = jest.fn();
    getDataRangeMock = jest.fn(() => ({
      getDisplayValues: getDisplayValuesMock,
    }));
    hideSheetMock = jest.fn();
    hideRowsMock = jest.fn();
    getLastRowMock = jest.fn(() => 5);
    getLastColumnMock = jest.fn(() => 3);
    getConditionalFormatRulesMock = jest.fn(() => []);
    setConditionalFormatRulesMock = jest.fn();

    sheetMock = {
      getDataRange: getDataRangeMock,
      getRange: getRangeMock,
      hideSheet: hideSheetMock,
      hideRows: hideRowsMock,
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
      newConditionalFormatRule: jest.fn(() => ({
        whenFormulaSatisfied: jest.fn().mockReturnThis(),
        setBackground: jest.fn().mockReturnThis(),
        setRanges: jest.fn().mockReturnThis(),
        build: jest.fn(() => "rule"),
      })),
    } as any;
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
      ["Header1", "Header2"],
      [1, 2],
      [3, 4],
    ];
    getDisplayValuesMock.mockReturnValue(data);
    const repo = new WorkoutRepository("Workout");
    const result = repo.getWorkout();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getDisplayValuesMock).toHaveBeenCalled();
    expect(result).toEqual(data);
  });

  it("sets workout data", () => {
    const repo = new WorkoutRepository("Workout");
    const data = [
      ["Header1", "Header2"],
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
  });

  it("hides rows using the correct 1-based index and count", () => {
    const repo = new WorkoutRepository("Workout");
    // Provide unordered, 0-based row indices
    repo.hideRows([4, 2, 3]);
    // Should call hideRows with (3, 3) because min([4,2,3]) + 1 = 3, length = 3
    expect(sheetMock.hideRows).toHaveBeenCalledWith(3, 3);
  });
});
