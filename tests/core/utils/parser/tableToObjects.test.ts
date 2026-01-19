import { tableToObjects } from "../../../../src/core";

describe("tableToObjects", () => {
  it("tableToObjects returns correct keys with headerMap", () => {
    const data = [
      ["Date Updated", "Lift", "Weight"],
      ["2026-01-01", "Squat", "100"],
      ["2026-01-01", "Bench", "80"],
    ];
    const headerMap = {
      "Date Updated": "dateUpdated",
      Lift: "lift",
      Weight: "weight",
    };
    const result = tableToObjects(data, headerMap);
    expect(result).toEqual([
      { dateUpdated: "2026-01-01", lift: "Squat", weight: "100" },
      { dateUpdated: "2026-01-01", lift: "Bench", weight: "80" },
    ]);
  });
});
