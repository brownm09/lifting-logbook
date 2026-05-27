import { tableToObjects } from "@src/core";

describe("tableToObjects", () => {
  it("tableToObjects returns correct keys with headerMap", () => {
    const data = [
      ["Date Updated", "Lift", "Weight"],
      [new Date("2026-01-01"), "Squat", "100"],
      [new Date("2026-01-01"), "Bench", "80"],
    ];
    const headerMap = {
      "Date Updated": "dateUpdated",
      Lift: "lift",
      Weight: "weight",
    };
    const result = tableToObjects(data, headerMap);
    expect(result).toEqual([
      { dateUpdated: new Date("2026-01-01"), lift: "Squat", weight: "100" },
      { dateUpdated: new Date("2026-01-01"), lift: "Bench", weight: "80" },
    ]);
  });

  // Audit (#354): explicitly exercise the `data.length < 2` neutral-return branch
  // so the empty-result path is distinguishable from the success path.
  it("returns [] when data is empty", () => {
    expect(tableToObjects([])).toEqual([]);
  });

  it("returns [] when data has only a header row (no body rows)", () => {
    expect(tableToObjects([["Date Updated", "Lift", "Weight"]])).toEqual([]);
  });

  it("uses raw header when headerMap is omitted", () => {
    const data = [
      ["Lift", "Weight"],
      ["Squat", "100"],
    ];
    const result = tableToObjects(data);
    expect(result).toEqual([{ Lift: "Squat", Weight: "100" }]);
  });
});
