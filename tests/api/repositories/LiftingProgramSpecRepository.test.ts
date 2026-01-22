import { LiftingProgramSpecRepository } from "../../../src/api/repositories/LiftingProgramSpecRepository";
import { cropSheet } from "../../../src/api/utils/cropSheet";
import * as core from "../../../src/core";

jest.mock("../../../src/core", () => ({
  mapLiftingProgramSpec: jest.fn((specs) => specs.map(() => [1, 2, 3])),
  parseLiftingProgramSpec: jest.fn((data) =>
    // Only parse if the first row is not a header
    data[0] && data[0][0] === "Header1"
      ? data
          .slice(1)
          .map(() => ({ name: "RPT", weeks: 12, lifts: ["Squat", "Bench"] }))
      : data.map(() => ({ name: "RPT", weeks: 12, lifts: ["Squat", "Bench"] })),
  ),
}));
jest.mock("../../../src/api/utils/cropSheet", () => ({
  cropSheet: jest.fn(),
}));

describe("LiftingProgramSpecRepository", () => {
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
        name === "RPT_PROGRAM_SPEC" ? sheetMock : undefined,
      ),
    };

    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("gets and parses lifting program specs", () => {
    const rawData = [
      ["Header1", "Header2", "Header3"],
      ["RPT", 12, ["Squat", "Bench"]],
    ];
    getValuesMock.mockReturnValue([...rawData]);
    const repo = new LiftingProgramSpecRepository();
    const result = repo.getLiftingProgramSpec();
    expect(getDataRangeMock).toHaveBeenCalled();
    expect(getValuesMock).toHaveBeenCalled();
    // Should remove header row before parsing
    expect(core.parseLiftingProgramSpec).toHaveBeenCalledWith([
      ["Header1", "Header2", "Header3"],
      ["RPT", 12, ["Squat", "Bench"]],
    ]);
    expect(result).toEqual([
      { name: "RPT", weeks: 12, lifts: ["Squat", "Bench"] },
    ]);
  });

  it("maps and sets lifting program specs, then trims sheet", () => {
    const repo = new LiftingProgramSpecRepository();
    const liftingProgramSpec = [
      { name: "RPT", weeks: 12, lifts: ["Squat", "Bench"] },
      { name: "RPT2", weeks: 8, lifts: ["Deadlift"] },
    ];
    repo.setLiftingProgramSpec(liftingProgramSpec as any);
    expect(core.mapLiftingProgramSpec).toHaveBeenCalledWith(liftingProgramSpec);
    expect(getRangeMock).toHaveBeenCalledWith(
      2,
      1,
      liftingProgramSpec.length,
      3,
    );
    expect(setValuesMock).toHaveBeenCalledWith([
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(cropSheet).toHaveBeenCalledWith(sheetMock);
  });

  it("throws if setValues fails", () => {
    setValuesMock.mockImplementation(() => {
      throw new Error("fail");
    });
    const repo = new LiftingProgramSpecRepository();
    const liftingProgramSpec = [
      { name: "RPT", weeks: 12, lifts: ["Squat", "Bench"] },
    ];
    expect(() => repo.setLiftingProgramSpec(liftingProgramSpec as any)).toThrow(
      "fail",
    );
  });
});
