let setHorizontalAlignmentMock: jest.Mock = jest.fn().mockReturnThis();
let setFontWeightMock: jest.Mock = jest.fn().mockReturnThis();
let getRangeMock: jest.Mock;
let sheetMock: any;
let whenFormulaSatisfiedMock: jest.Mock = jest.fn().mockReturnThis();
let newConditionalFormatRuleMock: jest.Mock = jest.fn(() => ({
  whenFormulaSatisfied: whenFormulaSatisfiedMock,
  setBackground: jest.fn().mockReturnThis(),
  setRanges: jest.fn().mockReturnThis(),
  build: jest.fn(),
}));
let setConditionalFormatRulesMock: jest.Mock = jest.fn();

let setBackgroundMock: jest.Mock = jest.fn().mockReturnThis();
let setRangesMock: jest.Mock = jest.fn().mockReturnThis();
let getLastRowMock: jest.Mock;
let getLastColumnMock: jest.Mock;
let hideColumnMock: jest.Mock = jest.fn();

jest.mock("@src/api/ui", () => ({
  ...jest.requireActual("@src/api/ui"),
  cropSheet: jest.fn(),
}));

// import * as cropSheet from "@src/api/ui";
import { WorkoutView } from "@src/api/ui";
import {
  createSheetMock,
  createSpreadsheetAppMock,
  createSpreadsheetMock,
} from "@tests/gasMocks";

describe("WorkoutView", () => {
  const data = [
    ["Program", "", "Cycle", "", "Weight", ""],
    ["Core Lift", "Scheme", "TM", "Inc. Amt.", "Lift Date", "Activ. Ex."],
    ["Bench", "5x5", 100, 2.5, "2026-01-01", ""],
    ["Date", "Lift", "Set", "Weight", "Reps", "Notes"],
    ["=2026-01-01", "Bench", 1, 100, 5, ""],
    ["=2026-01-01", "Bench", 2, 95, 5, ""],
  ];
  // const mockRange = createRangeMock();
  const mockSheet = {
    ...createSheetMock("RPT_2026_Cycle_1_20260101", data),
    setFrozenRows: jest.fn().mockReturnThis(),
    getConditionalFormatRules: jest.fn().mockReturnValue([]),
    setConditionalFormatRules: setConditionalFormatRulesMock,
    hideColumn: hideColumnMock,
  };
  const mockRange = {
    ...mockSheet.getRange(),
    setHorizontalAlignment: setHorizontalAlignmentMock,
    setFontWeight: setFontWeightMock,
  };
  mockSheet.getRange = jest.fn(() => mockRange as any);
  const ssMock = createSpreadsheetMock([mockSheet]);
  const ssAppMock = {
    ...createSpreadsheetAppMock(ssMock),
    newConditionalFormatRule: newConditionalFormatRuleMock,
  };
  let toastSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    global.SpreadsheetApp = ssAppMock as any;
    global.Logger = {
      log: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("formatWorkoutSheet", () => {
    it("formats header rows and freezes top rows", () => {
      let autoResizeColumnsMock: jest.Mock = jest.fn();
      let setFrozenRowsMock: jest.Mock = jest.fn();
      let getRangeMock = {
        ...mockSheet.getRange,
        setHorizontalAlignment: setHorizontalAlignmentMock,
        setFontWeight: setFontWeightMock,
      };
      mockSheet.getRange = jest.fn(() => getRangeMock as any);
      const sheet = {
        ...mockSheet,
        autoResizeColumns: autoResizeColumnsMock,
        setFrozenRows: setFrozenRowsMock,
      };
      // Spy on highlightTodayRows
      const highlightTodayRowsSpy = jest
        .spyOn(WorkoutView, "highlightTodayRows")
        .mockImplementation(jest.fn());

      getLastRowMock = jest.fn(() => data.length);
      sheet.getLastRow = getLastRowMock;
      getLastColumnMock = jest.fn(() => data[0].length);
      sheet.getLastColumn = getLastColumnMock;

      WorkoutView.formatWorkoutSheet(data, sheet as any);

      // Should freeze first two rows
      expect(setFrozenRowsMock).toHaveBeenCalledWith(2);
      // Should auto resize columns
      expect(autoResizeColumnsMock).toHaveBeenCalledWith(1, 6);
      // Should call cropSheet
      // expect(cropSheet).toHaveBeenCalledWith(sheet);
      // Should format header rows (rows with "Lift")
      expect(sheet.getRange).toHaveBeenCalledWith(2, 1, 1, 6);
      expect(sheet.getRange).toHaveBeenCalledWith(4, 1, 1, 6);
      // Should highlight today's rows based on date in column 1
      expect(highlightTodayRowsSpy).toHaveBeenCalledWith(sheet, 1);
      // Should center align all cells
      expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 6, 6);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("center");
      // Should left align Notes column
      expect(sheet.getRange).toHaveBeenCalledWith(5, 6, 2, 1);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("left");
      expect(hideColumnMock).toHaveBeenCalledWith(sheet.getRange(1, 1));
      expect(hideColumnMock).toHaveBeenCalledWith(sheet.getRange(1, 3));
      highlightTodayRowsSpy.mockRestore();
    });

    it("does not throw if no header rows found", () => {
      const data = [
        ["A", "B", "C"],
        ["1", "2", "3"],
      ];
      expect(() =>
        WorkoutView.formatWorkoutSheet(data, mockSheet as any),
      ).not.toThrow();
    });
  });

  describe("headerifyRow", () => {
    it("formats the specified row as header", () => {
      const sheet = {
        ...mockSheet,
      };
      const range = {
        ...sheet.getRange,
        setHorizontalAlignment: setHorizontalAlignmentMock,
        setFontWeight: setFontWeightMock,
      };
      sheet.getRange = jest.fn(() => range as any);
      WorkoutView.headerifyRow(sheet as any, 3);
      expect(sheet.getRange).toHaveBeenCalledWith(3, 1, 1, 6);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("center");
      expect(setFontWeightMock).toHaveBeenCalledWith("bold");
    });
  });

  describe("highlightTodayRows", () => {
    it("adds a conditional format rule for today", () => {
      let getConditionalFormatRulesMock: jest.Mock = jest
        .fn()
        .mockReturnValue([]);

      global.SpreadsheetApp = {
        ...ssAppMock,
        newConditionalFormatRule: newConditionalFormatRuleMock,
      } as any;
      getLastRowMock = jest.fn(() => 10);
      const sheet = {
        ...mockSheet,
        getLastRow: getLastRowMock,
        getConditionalFormatRules: getConditionalFormatRulesMock,
        setConditionalFormatRules: setConditionalFormatRulesMock,
      };
      mockSheet.getLastRow = getLastRowMock;

      WorkoutView.highlightTodayRows(sheet as any, 1);

      expect(getConditionalFormatRulesMock).toHaveBeenCalled();
      expect(newConditionalFormatRuleMock).toHaveBeenCalled();
      expect(whenFormulaSatisfiedMock).toHaveBeenCalledWith("=$A2=TODAY()");
      expect(setConditionalFormatRulesMock).toHaveBeenCalled();
    });

    it("does nothing if lastRow < 2", () => {
      const sheet = { ...mockSheet, getLastRow: jest.fn(() => 1) };
      WorkoutView.highlightTodayRows(sheet as any, 1);
      expect(setConditionalFormatRulesMock).not.toHaveBeenCalled();
    });
  });
});
