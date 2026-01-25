import { CycleDashboardRepository } from "@src/api/repositories";
import { cropSheet } from "@src/api/ui";
import * as core from "@src/core";

jest.mock("@src/core/utils", () => ({
  mapCycleDashboard: jest.fn((dashboard) => [[1, 2, 3]]),
  parseCycleDashboard: jest.fn((data) => ({
    cycle: 1,
    startDate: "2026-01-19",
    notes: "Test",
  })),
}));
jest.mock("@src/api/ui", () => ({
  cropSheet: jest.fn(),
}));

describe("CycleDashboardRepository", () => {
  let sheetMock: any;
  let ssMock: any;
  let getDataRangeMock: jest.Mock;
  let getDisplayValuesMock: jest.Mock;
  let getValuesMock: jest.Mock;
  let getRangeMock: jest.Mock;
  let setValuesMock: jest.Mock;

  beforeEach(() => {
    setValuesMock = jest.fn();
    getRangeMock = jest.fn(() => ({
      setValues: setValuesMock,
    }));
    getDisplayValuesMock = jest.fn();
    getValuesMock = jest.fn();
    getDataRangeMock = jest.fn(() => ({
      getDisplayValues: getDisplayValuesMock,
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
      [1, "2026-01-19", "http://Test"],
    ];
    const displayData = [
      ["Header1", "Header2", "Header3"],
      [1, "2026-01-19", "Test"],
    ];
    getDisplayValuesMock.mockReturnValue([...displayData]);
    getValuesMock.mockReturnValue([...rawData]);
    const repo = new CycleDashboardRepository();
    const result = repo.getCycleDashboard();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getDisplayValuesMock).toHaveBeenCalled();
    expect(getValuesMock).not.toHaveBeenCalled();
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

  it("maps and sets cycle dashboard, replaces sheetName with hyperlink formula, then trims sheet", () => {
    const repo = new CycleDashboardRepository();

    // Mock getSheetByName and getSheetId for hyperlink formula
    const workoutSheetMock = { getSheetId: jest.fn(() => 123456) };
    ssMock.getSheetByName.mockImplementation((name: string) =>
      name === "DASHBOARD"
        ? sheetMock
        : name === "WorkoutSheet"
          ? workoutSheetMock
          : undefined,
    );
    (global.SpreadsheetApp.getActiveSpreadsheet as jest.Mock).mockReturnValue(
      ssMock,
    );
    global.SpreadsheetApp.getActiveSpreadsheet().getUrl = jest.fn(
      () => "https://docs.google.com/spreadsheets/d/123",
    );

    const cycleDashboard = {
      cycle: 1,
      startDate: "2026-01-19",
      notes: "Test",
      sheetName: "WorkoutSheet",
    };

    repo.setCycleDashboard(cycleDashboard as any);

    // The sheetName should be replaced with a HYPERLINK formula
    const expectedLink = `=HYPERLINK("https://docs.google.com/spreadsheets/d/123#gid=123456", "WorkoutSheet")`;
    expect(core.mapCycleDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ sheetName: expectedLink }),
    );
    expect(getRangeMock).toHaveBeenCalledWith(2, 1, 1, 3);
    expect(setValuesMock).toHaveBeenCalledWith([[1, 2, 3]]);
    expect(cropSheet).toHaveBeenCalledWith(sheetMock);
  });

  it("throws an error when the sheet is not found", () => {
    const repo = new CycleDashboardRepository();

    // Mock getSheetByName and getSheetId for hyperlink formula
    const workoutSheetMock = {
      getSheetId: jest.fn(() => {
        throw new Error("Sheet not found");
      }),
    };
    ssMock.getSheetByName.mockImplementation((name: string) =>
      name === "DASHBOARD"
        ? sheetMock
        : name === "WorkoutSheet"
          ? workoutSheetMock
          : undefined,
    );
    (global.SpreadsheetApp.getActiveSpreadsheet as jest.Mock).mockReturnValue(
      ssMock,
    );
    global.SpreadsheetApp.getActiveSpreadsheet().getUrl = jest.fn(
      () => "https://docs.google.com/spreadsheets/d/123",
    );

    const cycleDashboard = {
      cycle: 1,
      startDate: "2026-01-19",
      notes: "Test",
      sheetName: "WorkoutSheet",
    };

    expect(() => repo.setCycleDashboard(cycleDashboard as any)).toThrow(
      "Sheet not found",
    );
    expect(getRangeMock).not.toHaveBeenCalled();
    expect(setValuesMock).not.toHaveBeenCalled();
    expect(cropSheet).not.toHaveBeenCalled();
  });
});
