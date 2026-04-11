import { addDaysUTC, formatDateYYYYMMDD, getNextDate } from "@src/core";

describe("jsUtil", () => {
  describe("formatDateYYYYMMDD", () => {
    it("formats Date object to YYYY-MM-DD (UTC)", () => {
      const date = new Date(2026, 0, 1); // Jan 1, 2026 UTC
      expect(formatDateYYYYMMDD(date)).toBe("20260101");
    });
    it("formats MM/DD/YYYY string to YYYY-MM-DD (UTC)", () => {
      expect(formatDateYYYYMMDD("1/1/2026")).toBe("20260101");
    });
    it("formats YYYY-MM-DD string to YYYY-MM-DD (UTC)", () => {
      expect(formatDateYYYYMMDD("2026-01-01")).toBe("20260101");
    });
    it("handles already formatted string", () => {
      expect(formatDateYYYYMMDD("2026-12-31")).toBe("20261231");
    });
  });

  describe("addDaysUTC", () => {
    it("adds days to a date in UTC", () => {
      const date = new Date(2026, 0, 1);
      const result = addDaysUTC(date, 5);
      expect(formatDateYYYYMMDD(result)).toBe("20260106");
    });
    it("handles negative days", () => {
      const date = new Date(2026, 0, 10);
      const result = addDaysUTC(date, -3);
      expect(formatDateYYYYMMDD(result)).toBe("20260107");
    });
    it("does not mutate the original date", () => {
      const date = new Date(2026, 0, 1);
      addDaysUTC(date, 10);
      expect(formatDateYYYYMMDD(date)).toBe("20260101");
    });
  });

  describe("getNextDate", () => {
    it("returns the next occurrence of prevDate's weekday at least 7 days after prevDate if no targetWeekday is given", () => {
      const prevDate = new Date(2026, 0, 1); // Thursday, Jan 1, 2026
      // Next Thursday after Jan 1, 2026 is Jan 8, 2026, but must be at least 7 days after prevDate, so Jan 8, 2026
      const result = getNextDate(prevDate, undefined, new Date(2026, 0, 2));
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(8);
    });

    it("returns correct date when prevDate is on Sunday and no targetWeekday is given", () => {
      const prevDate = new Date(2026, 0, 4); // Sunday, Jan 4, 2026
      // Next Sunday at least 7 days after is Jan 11, 2026
      const result = getNextDate(prevDate, undefined, new Date(2026, 0, 5));
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(11);
    });

    it("returns correct date when prevDate is on Saturday and no targetWeekday is given", () => {
      const prevDate = new Date(2026, 0, 3); // Saturday, Jan 3, 2026
      // Next Saturday at least 7 days after is Jan 10, 2026
      const result = getNextDate(prevDate, undefined, new Date(2026, 0, 4));
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(10);
    });

    it("returns today if today matches targetWeekday and is at least 7 days after prevDate", () => {
      const prevDate = new Date(2026, 0, 1); // Thursday
      const today = new Date(2026, 0, 8); // Next Thursday
      const result = getNextDate(prevDate, 4, today); // 4 = Thursday
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(8);
    });

    it("returns most recent occurrence of targetWeekday if at least 7 days after prevDate", () => {
      const prevDate = new Date(2026, 0, 1); // Thursday
      const today = new Date(2026, 0, 10); // Saturday
      // Most recent Thursday is Jan 8, 2026
      const result = getNextDate(prevDate, 4, today); // 4 = Thursday
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(8);
    });

    it("returns the next valid occurrence at least 7 days after prevDate if today and most recent are too soon", () => {
      const prevDate = new Date(2026, 0, 1); // Thursday
      const today = new Date(2026, 0, 2); // Friday
      // Next Thursday after Jan 1, 2026 is Jan 8, 2026
      const result = getNextDate(prevDate, 4, today); // 4 = Thursday
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(8);
    });

    it("handles week wrap-around for targetWeekday before prevDate's weekday", () => {
      const prevDate = new Date(2026, 0, 2); // Friday
      // Next Monday after Jan 2, 2026 is Jan 5, 2026, but must be at least 7 days after prevDate, so Jan 12, 2026
      const result = getNextDate(prevDate, 1, new Date(2026, 0, 3)); // 1 = Monday
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(12);
    });

    it("returns correct date when prevDate is already on the targetWeekday", () => {
      const prevDate = new Date(2026, 0, 5); // Monday
      // Next Monday at least 7 days after is Jan 12, 2026
      const result = getNextDate(prevDate, 1, new Date(2026, 0, 6)); // 1 = Monday
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(12);
    });

    it("returns correct date when prevDate is far in the past", () => {
      const prevDate = new Date(2020, 0, 1); // Wednesday
      const today = new Date(2026, 0, 8); // Thursday
      // Most recent Thursday is Jan 8, 2026
      const result = getNextDate(prevDate, 4, today);
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(8);
    });

    it("returns correct date when prevDate is on leap year day", () => {
      const prevDate = new Date(2024, 1, 29); // Thursday, Feb 29, 2024 (leap year
      // Next Thursday at least 7 days after is Mar 7, 2024
      const result = getNextDate(prevDate, 4, new Date(2024, 2, 1));
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(2);
      expect(result.getUTCDate()).toBe(7);
    });

    it("returns correct date when prevDate is at end of year", () => {
      const prevDate = new Date(2025, 11, 31); // Wednesday, Dec 31, 2025
      // Next Wednesday at least 7 days after is Jan 7, 2026
      const result = getNextDate(prevDate, undefined, new Date(2026, 0, 1));
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(0);
      expect(result.getUTCDate()).toBe(7);
    });
  });
});
