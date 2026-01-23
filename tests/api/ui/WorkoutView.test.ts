import { WorkoutView } from "../../../src/api/ui/WorkoutView";

// Mock Google Apps Script objects
const mockSheet = {
  setFrozenRows: jest.fn(),
  autoResizeColumns: jest.fn(),
  getLastColumn: jest.fn(() => 6),
  getLastRow: jest.fn(() => 10),
  getRange: jest.fn(() => ({
    setHorizontalAlignment: jest.fn().mockReturnThis(),
    setFontWeight: jest.fn().mockReturnThis(),
  })),
  getConditionalFormatRules: jest.fn(() => []),
  setConditionalFormatRules: jest.fn(),
};

jest.mock("../../../src/api/utils", () => ({
  cropSheet: jest.fn(),
}));

const newConditionalFormatRuleMock: jest.Mock = jest.fn(() => ({
  whenFormulaSatisfied: jest.fn().mockReturnThis(),
  setBackground: jest.fn().mockReturnThis(),
  setRanges: jest.fn().mockReturnThis(),
  build: jest.fn(() => "rule"),
}));

// Mock SpreadsheetApp for conditional formatting
global.SpreadsheetApp = {
  newConditionalFormatRule: newConditionalFormatRuleMock,
} as any;

describe("WorkoutView", () => {
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
      ];
      WorkoutView.formatWorkoutSheet(data, mockSheet as any);

      // Should freeze first two rows
      expect(mockSheet.setFrozenRows).toHaveBeenCalledWith(2);
      // Should auto resize columns
      expect(mockSheet.autoResizeColumns).toHaveBeenCalledWith(1, 6);
      // Should call cropSheet
      const { cropSheet } = require("../../../src/api/utils");
      expect(cropSheet).toHaveBeenCalledWith(mockSheet);

      // Should format header rows (rows with "Lift")
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 1, 1, 6);
      expect(mockSheet.getRange).toHaveBeenCalledWith(4, 1, 1, 6);
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
      WorkoutView.headerifyRow(mockSheet as any, 3);
      expect(mockSheet.getRange).toHaveBeenCalledWith(3, 1, 1, 6);
    });
  });

  describe("highlightTodayRows", () => {
    it("adds a conditional format rule for today", () => {
      WorkoutView.highlightTodayRows(mockSheet as any, 1);
      expect(mockSheet.setConditionalFormatRules).toHaveBeenCalled();
    });

    it("does nothing if lastRow < 2", () => {
      const sheet = { ...mockSheet, getLastRow: jest.fn(() => 1) };
      WorkoutView.highlightTodayRows(sheet as any, 1);
      expect(sheet.setConditionalFormatRules).not.toHaveBeenCalled();
    });
  });
});
