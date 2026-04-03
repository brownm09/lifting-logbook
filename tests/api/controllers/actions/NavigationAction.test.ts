import { MSG_ERROR_NAV_TO_WORKOUT, MSG_ERROR_SHEET_NOT_FOUND } from "@src/api/constants/constants";
import {
  NavigationAction,
  NavToCurrentWorkoutAction,
} from "@src/api/controllers/actions/NavigationAction";
import { CycleDashboardRepository } from "@src/api/repositories";
import { runWithErrorHandling } from "@src/api/ui";

jest.mock("@src/api/repositories");
jest.mock("@src/api/ui");

describe("NavigationAction", () => {
  let getActiveSpreadsheetMock: jest.Mock;
  let getSheetByNameMock: jest.Mock;
  let activateMock: jest.Mock;
  let runWithErrorHandlingMock: jest.Mock;

  beforeEach(() => {
    activateMock = jest.fn();
    getSheetByNameMock = jest.fn();
    getActiveSpreadsheetMock = jest.fn(() => ({
      getSheetByName: getSheetByNameMock,
    }));
    global.SpreadsheetApp = {
      getActiveSpreadsheet: getActiveSpreadsheetMock,
    } as any;

    runWithErrorHandlingMock = jest.fn((fn) => fn());
    (runWithErrorHandling as jest.Mock).mockImplementation(
      runWithErrorHandlingMock,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("activates the sheet if found", () => {
    getSheetByNameMock.mockReturnValue({ activate: activateMock });
    const action = new NavigationAction();
    action.run("Sheet1");
    expect(getActiveSpreadsheetMock).toHaveBeenCalled();
    expect(getSheetByNameMock).toHaveBeenCalledWith("Sheet1");
    expect(activateMock).toHaveBeenCalled();
    expect(runWithErrorHandlingMock).toHaveBeenCalled();
  });

  it("throws error if sheet not found", () => {
    getSheetByNameMock.mockReturnValue(undefined);
    const action = new NavigationAction();
    expect(() => action.run("MissingSheet")).toThrow(
      MSG_ERROR_SHEET_NOT_FOUND("MissingSheet"),
    );
    expect(getSheetByNameMock).toHaveBeenCalledWith("MissingSheet");
    expect(runWithErrorHandlingMock).toHaveBeenCalled();
  });
});

describe("NavToCurrentWorkoutAction", () => {
  let getCycleDashboardMock: jest.Mock;
  let runMock: jest.Mock;

  beforeEach(() => {
    getCycleDashboardMock = jest.fn();
    (CycleDashboardRepository as any).mockImplementation(() => ({
      getCycleDashboard: getCycleDashboardMock,
    }));
    runMock = jest.fn();
    NavigationAction.prototype.run = runMock;
    (runWithErrorHandling as jest.Mock).mockImplementation((fn) => fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("navigates to the current workout sheet", () => {
    getCycleDashboardMock.mockReturnValue({ sheetName: "CurrentSheet" });
    const action = new NavToCurrentWorkoutAction();
    action.run();
    expect(getCycleDashboardMock).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalledWith("CurrentSheet");
  });

  it("throws error if navigation fails", () => {
    getCycleDashboardMock.mockReturnValue({ sheetName: "CurrentSheet" });
    runMock.mockImplementation(() => {
      throw new Error("fail");
    });
    const action = new NavToCurrentWorkoutAction();
    expect(() => action.run()).toThrow(
      MSG_ERROR_NAV_TO_WORKOUT("CurrentSheet", "fail"),
    );
  });
});
