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

jest.mock("@src/api/ui", () => ({
  ...jest.requireActual("@src/api/ui"),
  cropSheet: jest.fn(),
}));

// import * as cropSheet from "@src/api/ui";
import { LiftRecordsView } from "@src/api/ui";
import {
  createSheetMock,
  createSpreadsheetAppMock,
  createSpreadsheetMock,
} from "@tests/gasMocks";

describe("LiftRecordsView", () => {
  const data = [
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

  describe("formatLiftRecordsSheet", () => {
    let getConditionalFormatRulesMock: jest.Mock;
    // getLastRowMock = jest.fn(() => 10);
    mockSheet.getLastRow = getLastRowMock;

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
      getLastRow: getLastRowMock,
      autoResizeColumns: autoResizeColumnsMock,
      setFrozenRows: setFrozenRowsMock,
      getConditionalFormatRules: getConditionalFormatRulesMock,
      setConditionalFormatRules: setConditionalFormatRulesMock,
    };
    // Spy on stripeRows
    const stripeRowsSpy = jest
      .spyOn(LiftRecordsView, "stripeRows")
      .mockImplementation(jest.fn());

    getLastRowMock = jest.fn(() => data.length);
    sheet.getLastRow = getLastRowMock;
    getLastColumnMock = jest.fn(() => data[0].length);
    sheet.getLastColumn = getLastColumnMock;

    it("stripes rows, formats header rows, and freezes top rows", () => {
      getConditionalFormatRulesMock = jest.fn().mockReturnValue([]);
      sheet.getConditionalFormatRules = getConditionalFormatRulesMock;
      LiftRecordsView.formatLiftRecordsSheet(data, sheet as any);

      // Should freeze first two rows
      expect(setFrozenRowsMock).toHaveBeenCalledWith(1);
      // Should auto resize columns
      expect(autoResizeColumnsMock).toHaveBeenCalledWith(1, 6);
      // Should call cropSheet
      // expect(cropSheet).toHaveBeenCalledWith(sheet);
      // Should format header rows (rows with "Lift")
      // expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 3, 6);
      // Should stripe rows
      expect(stripeRowsSpy).toHaveBeenCalledWith(sheet);
      // Implemented is mocked, so no getRange() call
      // expect(sheet.getRange).toHaveBeenCalledWith(2, 1, 3, 6);
      // Should center align all cells
      expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 3, 6);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("center");
      // Should left align Notes column
      expect(sheet.getRange).toHaveBeenCalledWith(2, 6, 3, 1);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("left");
      expect(sheet.getRange).toHaveBeenCalledTimes(2);
      stripeRowsSpy.mockRestore();
    });

    it("does not call stripeRows if striped rule already exists", () => {
      // Mock a rule with ISEVEN(ROW()) formula
      const mockRule = {
        getBooleanCondition: jest.fn(() => ({
          getCriteriaValues: jest.fn(() => ["=ISEVEN(ROW())"]),
        })),
      };
      getConditionalFormatRulesMock = jest.fn().mockReturnValue([mockRule]);
      sheet.getConditionalFormatRules = getConditionalFormatRulesMock;
      // Reset spy
      stripeRowsSpy.mockClear();
      LiftRecordsView.formatLiftRecordsSheet(data, sheet as any);
      expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 3, 6);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("center");
      // Should left align Notes column
      expect(sheet.getRange).toHaveBeenCalledWith(2, 6, 3, 1);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("left");
      expect(sheet.getRange).toHaveBeenCalledTimes(2);
      expect(stripeRowsSpy).not.toHaveBeenCalled();
    });

    it("does throw if no date header rows found", () => {
      const data = [
        ["A", "B", "Notes"],
        ["1", "2", "3"],
      ];
      expect(() =>
        LiftRecordsView.formatLiftRecordsSheet(data, mockSheet as any),
      ).toThrow();
    });

    it("does throw if no notes header rows found", () => {
      const data = [
        ["Date", "B", "C"],
        ["1", "2", "3"],
      ];
      expect(() =>
        LiftRecordsView.formatLiftRecordsSheet(data, mockSheet as any),
      ).toThrow();
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
      LiftRecordsView.headerifyRow(sheet as any, 3);
      expect(sheet.getRange).toHaveBeenCalledWith(3, 1, 1, 6);
      expect(setHorizontalAlignmentMock).toHaveBeenCalledWith("center");
      expect(setFontWeightMock).toHaveBeenCalledWith("bold");
    });
  });

  describe("stripeRows", () => {
    it("adds a conditional format rule to stripe rows", () => {
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

      LiftRecordsView.stripeRows(sheet as any);

      // expect(getConditionalFormatRulesMock).toHaveBeenCalled();
      expect(newConditionalFormatRuleMock).toHaveBeenCalled();
      expect(whenFormulaSatisfiedMock).toHaveBeenCalledWith("=ISEVEN(ROW())");
      expect(setConditionalFormatRulesMock).toHaveBeenCalled();
    });

    it("does nothing if lastRow < 2", () => {
      const sheet = { ...mockSheet, getLastRow: jest.fn(() => 1) };
      LiftRecordsView.stripeRows(sheet as any);
      expect(setConditionalFormatRulesMock).not.toHaveBeenCalled();
    });
  });
});
