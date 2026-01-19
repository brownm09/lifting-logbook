import { CycleDashboardRepository } from "../../../src/api/repositories/CycleDashboardRepository";
import { cropSheet } from "../../../src/api/utils/cropSheet";
import * as core from "../../../src/core";

jest.mock("../../../src/core", () => ({
  mapCycleDashboard: jest.fn((dashboard) => [[1, 2, 3]]),
  parseCycleDashboard: jest.fn((data) => ({
    cycle: 1,
    startDate: "2026-01-19",
    notes: "Test",
  })),
}));
jest.mock("../../../src/api/utils/cropSheet", () => ({
  cropSheet: jest.fn(),
}));

describe("CycleDashboardRepository", () => {
  let sheetMock: any;
  let ssMock: any;
  let getDataRangeMock: jest.Mock;
  let getValuesMock: jest.Mock;
  let getRangeMock: jest.Mock;
  let setValuesMock: jest.Mock;

  beforeEach(() => {
    setValuesMock = jest.fn();
    getRangeMock = jest.fn(() => ({
      setValues: setValuesMock,
    }));
    getValuesMock = jest.fn();
    getDataRangeMock = jest.fn(() => ({
      getValues: getValuesMock,
    }));

    sheetMock = {
      getDataRange: getDataRangeMock,
      getRange: getRangeMock,
    };

    ssMock = {
      getSheetByName: jest.fn((name) =>
        name === "DASHBOARD" ? sheetMock : undefined,
      ),
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("gets and parses cycle dashboard, removing header row", () => {
    const rawData = [
      ["Header1", "Header2", "Header3"],
      [1, "2026-01-19", "Test"],
    ];
    getValuesMock.mockReturnValue([...rawData]);
    const repo = new CycleDashboardRepository();
    const result = repo.getCycleDashboard();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getValuesMock).toHaveBeenCalled();
    // Should remove header row before parsing
    expect(core.parseCycleDashboard).toHaveBeenCalledWith([
      [1, "2026-01-19", "Test"],
    ]);
    expect(result).toEqual({
      cycle: 1,
      startDate: "2026-01-19",
      notes: "Test",
    });
  });

  it("maps and sets cycle dashboard, then trims sheet", () => {
    const repo = new CycleDashboardRepository();
    const cycleDashboard = { cycle: 1, startDate: "2026-01-19", notes: "Test" };
    repo.setCycleDashboard(cycleDashboard as any);
    expect(core.mapCycleDashboard).toHaveBeenCalledWith(cycleDashboard);
    expect(getRangeMock).toHaveBeenCalledWith(2, 1, 1, 3);
    expect(setValuesMock).toHaveBeenCalledWith([[1, 2, 3]]);
    expect(cropSheet).toHaveBeenCalledWith(sheetMock);
  });

  it("throws if setValues fails", () => {
    setValuesMock.mockImplementation(() => {
      throw new Error("fail");
    });
    const repo = new CycleDashboardRepository();
    const cycleDashboard = { cycle: 1, startDate: "2026-01-19", notes: "Test" };
    expect(() => repo.setCycleDashboard(cycleDashboard as any)).toThrow("fail");
  });
});
