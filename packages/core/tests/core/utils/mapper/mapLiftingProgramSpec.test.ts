import {
  LIFTING_PROGRAM_SPEC_HEADER_MAP,
  LiftingProgramSpec,
  mapLiftingProgramSpec,
  parseLiftingProgramSpec,
} from "@src/core";

const specs: LiftingProgramSpec[] = [
  {
    offset: 0,
    lift: "Squat",
    increment: 5,
    order: 1,
    sets: 3,
    reps: 5,
    amrap: true,
    warmUpPct: "40,50,60",
    wtDecrementPct: 0,
    activation: "None",
  },
  {
    offset: 0,
    lift: "Bench",
    increment: 2.5,
    order: 2,
    sets: 3,
    reps: 5,
    amrap: false,
    warmUpPct: "40,50,60",
    wtDecrementPct: 0,
    activation: "None",
  },
];

describe("mapLiftingProgramSpec", () => {
  it("should map LiftingProgramSpec[] to 2D array with all columns and headers", () => {
    const headers = Object.keys(LIFTING_PROGRAM_SPEC_HEADER_MAP);
    const result = mapLiftingProgramSpec(specs);
    expect(result[0]).toEqual(headers);
    expect(result[1]).toEqual([0, "Squat", 5, 1, 3, 5, "TRUE", "40,50,60", 0, "None"]);
    expect(result[2]).toEqual([0, "Bench", 2.5, 2, 3, 5, "FALSE", "40,50,60", 0, "None"]);
  });

  it("maps amrap boolean to string so parseLiftingProgramSpec can round-trip it", () => {
    const roundTripped = parseLiftingProgramSpec(mapLiftingProgramSpec(specs));
    expect(roundTripped).toEqual(specs);
  });
});
