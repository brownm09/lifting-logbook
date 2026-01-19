import { TRAINING_MAX_HEADER_MAP, TrainingMax } from "../../../../src/core";
import { mapTrainingMaxes } from "../../../../src/core/utils/mapper/mapTrainingMaxes";

describe("mapTrainingMaxes", () => {
  it("should map TrainingMax[] to 2D array with all columns and headers", () => {
    const headers = Object.keys(TRAINING_MAX_HEADER_MAP);
    const maxes: TrainingMax[] = [
      {
        dateUpdated: "2026-01-01",
        lift: "Squat",
        weight: 200,
      },
      {
        dateUpdated: "2026-01-02",
        lift: "Bench",
        weight: 150,
      },
    ];
    const result = mapTrainingMaxes(maxes);
    expect(result[0]).toEqual(headers);
    expect(result[1]).toEqual(["2026-01-01", "Squat", 200]);
    expect(result[2]).toEqual(["2026-01-02", "Bench", 150]);
  });
});
