import { parseStrengthGoals } from "@src/core";
import { loadCsvFixture } from "../../../testUtils";

describe("parseStrengthGoals", () => {
  it("parses the transposed fixture into one entry per lift column", () => {
    const data = loadCsvFixture("strength_goals.csv");
    const goals = parseStrengthGoals(data);
    expect(goals).toHaveLength(4);

    const squat = goals.find((g) => g.lift === "Squat");
    expect(squat).toMatchObject({ goalType: "absolute", target: 405, unit: "lbs" });

    const deadlift = goals.find((g) => g.lift === "Deadlift");
    expect(deadlift).toMatchObject({ goalType: "relative", ratio: 2.0, unit: "lbs" });
    expect(deadlift!.target).toBeUndefined();
  });

  it("infers a relative goal when only a ratio is present", () => {
    const goals = parseStrengthGoals([
      ["Metric", "Squat"],
      ["Ratio", "2.5"],
      ["Unit", "kg"],
    ]);
    expect(goals).toEqual([
      expect.objectContaining({ lift: "Squat", goalType: "relative", ratio: 2.5, unit: "kg" }),
    ]);
  });

  it("skips lift columns with no goal data and is kg/lbs aware", () => {
    const goals = parseStrengthGoals([
      ["Metric", "Squat", "Bench", "Deadlift"],
      ["Goal Type", "absolute", "", "absolute"],
      ["Target", "300", "", "400"],
      ["Unit", "kg", "", "lbs"],
    ]);
    expect(goals.map((g) => g.lift)).toEqual(["Squat", "Deadlift"]);
    expect(goals[0]).toMatchObject({ unit: "kg", target: 300 });
    expect(goals[1]).toMatchObject({ unit: "lbs", target: 400 });
  });

  it("returns an empty array for an empty or header-only table", () => {
    expect(parseStrengthGoals([])).toEqual([]);
    expect(parseStrengthGoals([["Metric", "Squat"]])).toEqual([]);
  });
});
