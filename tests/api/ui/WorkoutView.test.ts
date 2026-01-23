import { WorkoutView } from "../../../src/api/ui/WorkoutView";

let setHorizontalAlignmentMock: jest.Mock;
let setFontWeightMock: jest.Mock;
let getRangeMock: jest.Mock;
let sheetMock: any;
let newConditionalFormatRuleMock: jest.Mock;
let getLastRowMock: jest.Mock;
let getLastColumnMock: jest.Mock;
let getConditionalFormatRulesMock: jest.Mock;
let setConditionalFormatRulesMock: jest.Mock;
let whenFormulaSatisfiedMock: jest.Mock;

jest.mock("../../../src/api/utils", () => ({
  cropSheet: jest.fn(),
}));

describe("WorkoutView", () => {
  beforeEach(() => {
    setHorizontalAlignmentMock = jest.fn().mockReturnThis();
    setFontWeightMock = jest.fn().mockReturnThis();
    getRangeMock = jest.fn(() => ({
      setHorizontalAlignment: setHorizontalAlignmentMock,
      setFontWeight: setFontWeightMock,
    }));
    // Mock Google Apps Script objects
    getLastColumnMock = jest.fn(() => 6);
    getLastRowMock = jest.fn(() => 10);
    getConditionalFormatRulesMock = jest.fn(() => []);
    setConditionalFormatRulesMock = jest.fn();
    whenFormulaSatisfiedMock = jest.fn().mockReturnThis();
    sheetMock = {
      setFrozenRows: jest.fn(),
      autoResizeColumns: jest.fn(),
      getLastColumn: getLastColumnMock,
      getLastRow: getLastRowMock,
      getRange: getRangeMock,
      getConditionalFormatRules: getConditionalFormatRulesMock,
      setConditionalFormatRules: setConditionalFormatRulesMock,
    };
    newConditionalFormatRuleMock = jest.fn(() => ({
      whenFormulaSatisfied: whenFormulaSatisfiedMock,
      setBackground: jest.fn().mockReturnThis(),
      setRanges: jest.fn().mockReturnThis(),
      build: jest.fn(() => "rule"),
    }));
    // Mock SpreadsheetApp for conditional formatting
    global.SpreadsheetApp = {
      newConditionalFormatRule: newConditionalFormatRuleMock,
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("formatWorkoutSheet", () => {
    it("formats header rows and freezes top rows", () => {
      const data = [
        ["Program", "", "Cycle", "", "Weight", ""],
        ["Core Lift", "Scheme", "TM", "Inc. Amt.", "Lift Date", "Activ. Ex."],
        ["Bench", "5x5", 100, 2.5, "2026-01-01", ""],
        ["Date", "Lift", "Set", "Weight", "Reps", "Notes"],
        ["=2026-01-01", "Bench", 1, 100, 5, ""],
        ["=2026-01-01", "Bench", 2, 95, 5, ""],
      ];
      // Spy on highlightTodayRows
      const highlightTodayRowsSpy = jest
        .spyOn(WorkoutView, "highlightTodayRows")
        .mockImplementation(jest.fn());
      getLastRowMock = jest.fn(() => data.length);
      sheetMock.getLastRow = getLastRowMock;
      getLastColumnMock = jest.fn(() => data[0].length);
      sheetMock.getLastColumn = getLastColumnMock;
      WorkoutView.formatWorkoutSheet(data, sheetMock as any);

      // Should freeze first two rows
      expect(sheetMock.setFrozenRows).toHaveBeenCalledWith(2);
      // Should auto resize columns
      expect(sheetMock.autoResizeColumns).toHaveBeenCalledWith(1, 6);
      // Should call cropSheet
      const { cropSheet } = require("../../../src/api/utils");
      expect(cropSheet).toHaveBeenCalledWith(sheetMock);

      // Should format header rows (rows with "Lift")
      expect(getRangeMock).toHaveBeenCalledWith(2, 1, 1, 6);
      expect(getRangeMock).toHaveBeenCalledWith(4, 1, 1, 6);
      // Should highlight today's rows based on date in column 1
      expect(WorkoutView.highlightTodayRows).toHaveBeenCalledWith(sheetMock, 1);
      // Should center align all cells
      expect(getRangeMock).toHaveBeenCalledWith(1, 1, 6, 6);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("center");
      // Should left align Notes column
      expect(getRangeMock).toHaveBeenCalledWith(5, 6, 2, 1);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("left");
      highlightTodayRowsSpy.mockRestore();
    });

    it("does not throw if no header rows found", () => {
      const data = [
        ["A", "B", "C"],
        ["1", "2", "3"],
      ];
      expect(() =>
        WorkoutView.formatWorkoutSheet(data, sheetMock as any),
      ).not.toThrow();
    });
  });

  describe("headerifyRow", () => {
    it("formats the specified row as header", () => {
      WorkoutView.headerifyRow(sheetMock as any, 3);
      expect(sheetMock.getRange).toHaveBeenCalledWith(3, 1, 1, 6);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("center");
      expect(setFontWeightMock).toHaveBeenCalledWith("bold");
    });
  });

  describe("highlightTodayRows", () => {
    it("adds a conditional format rule for today", () => {
      getLastRowMock = jest.fn(() => 10);
      sheetMock.getLastRow = getLastRowMock;
      WorkoutView.highlightTodayRows(sheetMock as any, 1);
      expect(getConditionalFormatRulesMock).toHaveBeenCalled();
      expect(newConditionalFormatRuleMock).toHaveBeenCalled();
      expect(setConditionalFormatRulesMock).toHaveBeenCalled();
      expect(whenFormulaSatisfiedMock).toHaveBeenCalledWith("=$A2=TODAY()");
    });

    it("does nothing if lastRow < 2", () => {
      const sheet = { ...sheetMock, getLastRow: jest.fn(() => 1) };
      WorkoutView.highlightTodayRows(sheet as any, 1);
      expect(setConditionalFormatRulesMock).not.toHaveBeenCalled();
    });
  });
});
