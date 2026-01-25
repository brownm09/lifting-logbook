jest.mock("@src/core/utils", () => ({
  parseTrainingMaxes: jest.fn(() => []),
  mapTrainingMaxes: jest.fn(() => []),
}));

import {
  MSG_ERROR_SHEET_NOT_FOUND,
  SHEET_NAME_TRAINING_MAXES,
} from "@src/api/constants/constants";
import { TrainingMaxRepository } from "@src/api/repositories";
import * as coreUtils from "@src/core/utils";
import { gasMock } from "@tests/testUtils";

describe("TrainingMaxRepository", () => {
  const ssMock = gasMock<GoogleAppsScript.Spreadsheet.Spreadsheet>();
  const sheetMock = gasMock<GoogleAppsScript.Spreadsheet.Sheet>();
  const rangeMock = gasMock<GoogleAppsScript.Spreadsheet.Range>();
  global.SpreadsheetApp = ssMock as any;
  const rawData = [
    ["Header1", "Header2"],
    ["Squat", 100],
    ["Bench", 80],
  ];
  const trainingMaxes = [
    { dateUpdated: new Date("2024-06-01"), lift: "Squat", weight: 100 },
    { dateUpdated: new Date("2024-06-01"), lift: "Bench", weight: 80 },
  ];

  beforeEach(() => {
    (ssMock.getSheetByName as jest.Mock).mockImplementation(() => sheetMock);
    (ssMock.getActiveSheet as jest.Mock).mockReturnValue(sheetMock);
    (sheetMock.getName as jest.Mock).mockReturnValue(SHEET_NAME_TRAINING_MAXES);
    (sheetMock.getDataRange as jest.Mock).mockReturnValue(rangeMock);
    (rangeMock.getDisplayValues as jest.Mock).mockReturnValue(rawData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    beforeEach(() => {
      (ssMock.getSheetByName as jest.Mock).mockImplementation((name) => {
        return name === SHEET_NAME_TRAINING_MAXES ? sheetMock : undefined;
      });
    });
    it("sets the sheet if available", () => {
      (ssMock.getSheetByName as jest.Mock).mockReturnValue(sheetMock);
      expect(() => new TrainingMaxRepository()).not.toThrow();
      expect(ssMock.getSheetByName).toHaveBeenCalledWith(
        SHEET_NAME_TRAINING_MAXES,
      );
    });
    it("throws if TRAINING_MAXES sheet is missing", () => {
      (ssMock.getSheetByName as jest.Mock).mockReturnValue(undefined);
      expect(() => new TrainingMaxRepository()).toThrow(
        MSG_ERROR_SHEET_NOT_FOUND(SHEET_NAME_TRAINING_MAXES),
      );
      expect(ssMock.getSheetByName).toHaveBeenCalledWith(
        SHEET_NAME_TRAINING_MAXES,
      );
    });
  });

  describe("getTrainingMaxes", () => {
    it("gets and parses training maxes", () => {
      (coreUtils.parseTrainingMaxes as jest.Mock).mockImplementation(
        () => trainingMaxes,
      );
      const repo = new TrainingMaxRepository();
      const result = repo.getTrainingMaxes();
      expect(sheetMock.getDataRange).toHaveBeenCalled();
      expect(rangeMock.getDisplayValues).toHaveBeenCalled();
      expect(coreUtils.parseTrainingMaxes).toHaveBeenCalledWith(rawData);
    });
  });
  describe("setTrainingMaxes", () => {
    beforeEach(() => {
      (coreUtils.mapTrainingMaxes as jest.Mock).mockImplementation(() =>
        rawData.slice(1),
      );
      (sheetMock.getRange as jest.Mock).mockImplementation(() => rangeMock);
    });

    it("maps and sets training maxes, then trims sheet", () => {
      (coreUtils.mapTrainingMaxes as jest.Mock).mockReturnValue(rawData);
      const repo = new TrainingMaxRepository();
      repo.setTrainingMaxes(trainingMaxes);
      expect(coreUtils.mapTrainingMaxes).toHaveBeenCalledWith(trainingMaxes);
      expect(sheetMock.getRange).toHaveBeenCalledWith(1, 1, rawData.length, 2);
      expect(rangeMock.setValues).toHaveBeenCalledWith(rawData);
    });

    it("throws if setValues fails", () => {
      (rangeMock.setValues as jest.Mock).mockImplementation(() => {
        throw new Error("fail");
      });
      const repo = new TrainingMaxRepository();
      expect(() => repo.setTrainingMaxes(trainingMaxes)).toThrow("fail");
    });
  });
});
