import { getNextDate } from "@src/core";

describe("getNextDate", () => {
  it("returns today if today matches previous weekday and is at least 7 days after prevDate", () => {
    const prevDate = new Date("1/5/2026"); // Monday
    const today = new Date("1/19/2026"); // Monday, 14 days later
    const result = getNextDate(prevDate, undefined, today);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(0); // January
    expect(result.getUTCDate()).toBe(19);
  });

  it("returns most recent previous weekday if today is a different weekday and at least 7 days after prevDate", () => {
    const prevDate = new Date("1/5/2026"); // Monday
    const today = new Date("1/20/2026"); // Tuesday
    const result = getNextDate(prevDate, undefined, today);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(0); // January
    expect(result.getUTCDate()).toBe(19); // Most recent Monday
  });

  it("returns next valid weekday if today and most recent are not at least 7 days after prevDate", () => {
    const prevDate = new Date("1/5/2026"); // Monday
    const today = new Date("1/8/2026"); // Thursday
    const result = getNextDate(prevDate, undefined, today);
    // Should be 1/12/2026 (next Monday at least 7 days after prevDate)
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(0); // January
    expect(result.getUTCDate()).toBe(12);
  });

  it("handles explicit targetWeekday (Friday)", () => {
    const prevDate = new Date("1/5/2026"); // Monday
    const today = new Date("1/23/2026"); // Friday
    const result = getNextDate(prevDate, 5, today); // 5 = Friday
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(0); // January
    expect(result.getUTCDate()).toBe(23);
  });
});
