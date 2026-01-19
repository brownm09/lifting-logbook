import { LiftRecordRepository } from "../../../src/api/repositories/LiftRecordRepository";
import { cropSheet } from "../../../src/api/utils/cropSheet";
import * as core from "../../../src/core";

jest.mock("../../../src/core", () => ({
  mapLiftRecords: jest.fn((records) => records.map(() => [1, 2])),
  parseLiftRecords: jest.fn((data) =>
    data.map(() => ({ lift: "Deadlift", reps: 5 })),
  ),
}));
jest.mock("../../../src/api/utils/cropSheet", () => ({
  cropSheet: jest.fn(),
}));

describe("LiftRecordRepository", () => {
  let sheetMock: any;
  let ssMock: any;
  let getDataRangeMock: jest.Mock;
  let getValuesMock: jest.Mock;
  let getRangeMock: jest.Mock;
  let setValuesMock: jest.Mock;
  let getLastRowMock: jest.Mock;
  let getLastColumnMock: jest.Mock;

  beforeEach(() => {
    setValuesMock = jest.fn();
    getRangeMock = jest.fn(() => ({
      setValues: setValuesMock,
    }));
    getValuesMock = jest.fn();
    getDataRangeMock = jest.fn(() => ({
      getValues: getValuesMock,
    }));
    getLastRowMock = jest.fn(() => 10);
    getLastColumnMock = jest.fn(() => 2);

    sheetMock = {
      getDataRange: getDataRangeMock,
      getRange: getRangeMock,
      getLastRow: getLastRowMock,
      getLastColumn: getLastColumnMock,
    };

    ssMock = {
      getSheetByName: jest.fn((name) =>
        name === "LIFT_RECORDS" ? sheetMock : undefined,
      ),
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("gets and parses lift records, removing header row", () => {
    const rawData = [
      ["Header1", "Header2"],
      ["Deadlift", 5],
      ["Bench", 3],
    ];
    getValuesMock.mockReturnValue([...rawData]);
    const repo = new LiftRecordRepository();
    const result = repo.getLiftRecords();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getValuesMock).toHaveBeenCalled();
    // Should remove header row before parsing
    expect(core.parseLiftRecords).toHaveBeenCalledWith([
      ["Deadlift", 5],
      ["Bench", 3],
    ]);
    expect(result).toEqual([
      { lift: "Deadlift", reps: 5 },
      { lift: "Deadlift", reps: 5 },
    ]);
  });

  it("maps and appends lift records, then trims sheet", () => {
    const repo = new LiftRecordRepository();
    const liftRecords = [
      { lift: "Deadlift", reps: 5 },
      { lift: "Bench", reps: 3 },
    ];
    repo.appendLiftRecords(liftRecords as any);
    expect(core.mapLiftRecords).toHaveBeenCalledWith(liftRecords);
    expect(getLastRowMock).toHaveBeenCalled();
    expect(getLastColumnMock).toHaveBeenCalled();
    expect(getRangeMock).toHaveBeenCalledWith(11, 1, liftRecords.length, 2);
    expect(setValuesMock).toHaveBeenCalledWith([
      [1, 2],
      [1, 2],
    ]);
    expect(cropSheet).toHaveBeenCalledWith(sheetMock);
  });

  it("throws if setValues fails", () => {
    setValuesMock.mockImplementation(() => {
      throw new Error("fail");
    });
    const repo = new LiftRecordRepository();
    const liftRecords = [{ lift: "Deadlift", reps: 5 }];
    expect(() => repo.appendLiftRecords(liftRecords as any)).toThrow("fail");
  });
});
