import { SheetRepository } from "../../../src/api/repositories/SheetRepository";

describe("SheetRepository", () => {
  let getSheetByNameMock: jest.Mock;
  let insertSheetMock: jest.Mock;
  let getRangeMock: jest.Mock;
  let setValuesMock: jest.Mock;
  let sheetMock: any;
  let ssMock: any;

  beforeEach(() => {
    setValuesMock = jest.fn().mockReturnThis();
    getRangeMock = jest.fn(() => ({
      setValues: setValuesMock,
    }));

    sheetMock = {
      getRange: getRangeMock,
      getName: jest.fn(() => "Sheet1"),
    };

    getSheetByNameMock = jest.fn();
    insertSheetMock = jest.fn(() => sheetMock);

    ssMock = {
      getSheetByName: getSheetByNameMock,
      insertSheet: insertSheetMock,
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns existing sheet if it exists", () => {
    getSheetByNameMock.mockReturnValue(sheetMock);
    const repo = new SheetRepository();
    const result = repo.createTableSheet("Sheet1", [
      [1, 2],
      [3, 4],
    ]);
    expect(getSheetByNameMock).toHaveBeenCalledWith("Sheet1");
    expect(result).toBe(sheetMock);
    expect(insertSheetMock).not.toHaveBeenCalled();
  });

  it("creates and formats a new sheet if it does not exist", () => {
    getSheetByNameMock.mockReturnValue(undefined);
    const repo = new SheetRepository();
    const data = [
      [1, 2],
      [3, 4],
    ];
    const result = repo.createTableSheet("Sheet2", data);

    expect(insertSheetMock).toHaveBeenCalledWith("Sheet2");
    expect(getRangeMock).toHaveBeenCalledWith(
      1,
      1,
      data.length,
      data[0].length,
    );
    expect(setValuesMock).toHaveBeenCalledWith(data);
    expect(result).toBe(sheetMock);
  });

  it("throws if insertSheet fails", () => {
    getSheetByNameMock.mockReturnValue(undefined);
    insertSheetMock.mockImplementation(() => {
      throw new Error("fail");
    });
    const repo = new SheetRepository();
    expect(() => repo.createTableSheet("Sheet3", [[1]])).toThrow("fail");
  });

  it("throws if setValues fails", () => {
    getSheetByNameMock.mockReturnValue(undefined);
    setValuesMock.mockImplementation(() => {
      throw new Error("fail");
    });
    const repo = new SheetRepository();
    expect(() => repo.createTableSheet("Sheet4", [[1]])).toThrow("fail");
  });
});
