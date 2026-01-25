import { findRepsHeaderCoordinates } from "@src/core";

describe("findRepsHeaderCoordinates", () => {
  it("returns correct coordinates when 'Reps' is found", () => {
    const data = [
      ["Header1", "Header2", "Header3", "Header4"],
      ["Lift", "Set Type", "Reps", "Weight"],
      ["Squat", "Warm-up", 5, 100],
      ["Squat", "Working", 3, 120],
    ];
    const coords = findRepsHeaderCoordinates(data, "Workout");
    expect(coords).toEqual({ row: 1, col: 2 });
  });

  it("returns correct coordinates when 'Reps' is not in the first row", () => {
    const data = [
      ["Header1", "Header2", "Header3", "Header4"],
      ["Lift", "Set Type", "Weight"],
      ["", "", ""],
      ["", "Reps", ""],
      ["Squat", "Working", 120],
    ];
    const coords = findRepsHeaderCoordinates(data, "Workout");
    expect(coords).toEqual({ row: 3, col: 1 });
  });

  it("throws if 'Reps' is not found in any row", () => {
    const data = [
      ["Header1", "Header2", "Header3"],
      ["Lift", "Set Type", "Weight"],
      ["Squat", "Warm-up", 100],
      ["Squat", "Working", 120],
    ];
    expect(() => findRepsHeaderCoordinates(data, "Workout")).toThrow(
      `"Reps" column not found in sheet Workout`,
    );
  });
});
