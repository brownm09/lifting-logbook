import { addDaysUTC, formatDateYYYYMMDD } from "../src/core/jsUtil";

describe("jsUtil", () => {
  describe("formatDateYYYYMMDD", () => {
    it("formats Date object to YYYY-MM-DD (UTC)", () => {
      const date = new Date(Date.UTC(2026, 0, 1)); // Jan 1, 2026 UTC
      expect(formatDateYYYYMMDD(date)).toBe("2026-01-01");
    });
    it("formats MM/DD/YYYY string to YYYY-MM-DD (UTC)", () => {
      expect(formatDateYYYYMMDD("1/1/2026")).toBe("2026-01-01");
    });
    it("formats YYYY-MM-DD string to YYYY-MM-DD (UTC)", () => {
      expect(formatDateYYYYMMDD("2026-01-01")).toBe("2026-01-01");
    });
    it("handles already formatted string", () => {
      expect(formatDateYYYYMMDD("2026-12-31")).toBe("2026-12-31");
    });
  });

  describe("addDaysUTC", () => {
    it("adds days to a date in UTC", () => {
      const date = new Date(Date.UTC(2026, 0, 1));
      const result = addDaysUTC(date, 5);
      expect(formatDateYYYYMMDD(result)).toBe("2026-01-06");
    });
    it("handles negative days", () => {
      const date = new Date(Date.UTC(2026, 0, 10));
      const result = addDaysUTC(date, -3);
      expect(formatDateYYYYMMDD(result)).toBe("2026-01-07");
    });
    it("does not mutate the original date", () => {
      const date = new Date(Date.UTC(2026, 0, 1));
      addDaysUTC(date, 10);
      expect(formatDateYYYYMMDD(date)).toBe("2026-01-01");
    });
  });
});
