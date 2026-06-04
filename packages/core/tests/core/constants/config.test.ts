import { MROUND, PROG_SPEC_WORK_PCTS } from "@src/core";

describe("MROUND", () => {
  it("rounds to the nearest multiple", () => {
    expect(MROUND(183, 5)).toBe(185);
    expect(MROUND(182, 5)).toBe(180);
  });

  it("returns the unrounded value when the multiple is 0 (no NaN)", () => {
    // A custom program saved with increment 0 must not poison weight math.
    expect(MROUND(187, 0)).toBe(187);
    expect(Number.isNaN(MROUND(187, 0))).toBe(false);
  });
});

describe("PROG_SPEC_WORK_PCTS", () => {
  it("produces a descending percentage per set", () => {
    expect(PROG_SPEC_WORK_PCTS(3, 0.1)).toEqual([1, 0.9, 0.8]);
  });

  it("returns a single full-percentage set when there is no decrement", () => {
    expect(PROG_SPEC_WORK_PCTS(1, 0.1)).toEqual([1]);
    expect(PROG_SPEC_WORK_PCTS(3, 0)).toEqual([1, 1, 1]);
  });

  it("throws a RangeError when the decrement drives a set negative", () => {
    // 1 - (3 - 1) * 0.6 = -0.2 → final set would be a negative weight.
    expect(() => PROG_SPEC_WORK_PCTS(3, 0.6)).toThrow(RangeError);
  });

  it("allows a decrement exactly at the boundary (final set = 0)", () => {
    expect(PROG_SPEC_WORK_PCTS(3, 0.5)).toEqual([1, 0.5, 0]);
  });
});
