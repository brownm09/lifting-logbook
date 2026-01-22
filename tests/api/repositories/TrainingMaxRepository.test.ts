jest.mock("../../../src/core", () => ({
  mapTrainingMaxes: jest.fn((maxes) => maxes.map(() => [1, 2])),
  parseTrainingMaxes: jest.fn((data) => [
    { lift: "Squat", max: 100 },
    { lift: "Bench", max: 80 },
  ]),
}));
jest.mock("../../../src/api/utils/cropSheet", () => ({
  cropSheet: jest.fn(),
}));

import { TrainingMaxRepository } from "../../../src/api/repositories/TrainingMaxRepository";
import { cropSheet } from "../../../src/api/utils/cropSheet";
import * as core from "../../../src/core";

describe("TrainingMaxRepository", () => {
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
      getDisplayValues: getValuesMock,
    }));

    sheetMock = {
      getDataRange: getDataRangeMock,
      getRange: getRangeMock,
    };

    ssMock = {
      getSheetByName: jest.fn((name) =>
        name === "TRAINING_MAXES" ? sheetMock : undefined,
      ),
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("gets and parses training maxes", () => {
    const rawData = [
      ["Header1", "Header2"],
      ["Squat", 100],
      ["Bench", 80],
    ];
    getValuesMock.mockReturnValue([...rawData]);
    const repo = new TrainingMaxRepository();
    const result = repo.getTrainingMaxes();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getValuesMock).toHaveBeenCalled();
    expect(core.parseTrainingMaxes).toHaveBeenCalledWith([
      ["Header1", "Header2"],
      ["Squat", 100],
      ["Bench", 80],
    ]);
    expect(result).toEqual([
      { lift: "Squat", max: 100 },
      { lift: "Bench", max: 80 },
    ]);
  });

  it("maps and sets training maxes, then trims sheet", () => {
    const repo = new TrainingMaxRepository();
    const trainingMaxes = [
      { dateUpdated: "2024-06-01", lift: "Squat", weight: 100 },
      { dateUpdated: "2024-06-01", lift: "Bench", weight: 80 },
    ];
    repo.setTrainingMaxes(trainingMaxes);
    expect(core.mapTrainingMaxes).toHaveBeenCalledWith(trainingMaxes);
    expect(getRangeMock).toHaveBeenCalledWith(2, 1, trainingMaxes.length, 2);
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
    const repo = new TrainingMaxRepository();
    const trainingMaxes = [
      { dateUpdated: "2024-06-01", lift: "Squat", weight: 100 },
    ];
    expect(() => repo.setTrainingMaxes(trainingMaxes)).toThrow("fail");
  });
});
