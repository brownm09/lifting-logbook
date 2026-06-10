import {
  buildLiftRecordsPreview,
  buildTrainingMaxPreview,
  buildStrengthGoalPreview,
  buildProgramSpecPreview,
  programSpecNaturalKey,
} from "@src/core";
import type {
  LiftRecord,
  TrainingMax,
  StrengthGoalEntry,
  LiftingProgramSpec,
} from "@src/core";

const liftRecord = (over: Partial<LiftRecord> = {}): LiftRecord => ({
  program: "p",
  cycleNum: 1,
  workoutNum: 1,
  date: new Date("2026-01-01"),
  lift: "back-squat",
  setNum: 1,
  weight: 100,
  reps: 5,
  notes: "",
  ...over,
});

describe("buildLiftRecordsPreview", () => {
  it("counts new rows as creates and existing natural keys as skips", () => {
    const existing = [liftRecord({ setNum: 1 })];
    const incoming = [liftRecord({ setNum: 1 }), liftRecord({ setNum: 2 })];
    const preview = buildLiftRecordsPreview(incoming, existing);
    expect(preview).toMatchObject({ creates: 1, updates: 0, skips: 1 });
  });

  it("collapses duplicate keys within the file", () => {
    const incoming = [liftRecord({ setNum: 1 }), liftRecord({ setNum: 1 })];
    const preview = buildLiftRecordsPreview(incoming, []);
    expect(preview.creates).toBe(1);
  });
});

describe("buildTrainingMaxPreview", () => {
  const tm = (lift: string, weight: number): TrainingMax => ({
    dateUpdated: new Date("2026-01-01"),
    lift,
    weight,
  });

  it("classifies create / update / skip by weight change", () => {
    const existing = [tm("squat", 300), tm("bench", 200)];
    const incoming = [tm("squat", 310), tm("bench", 200), tm("deadlift", 400)];
    const preview = buildTrainingMaxPreview(incoming, existing);
    expect(preview).toMatchObject({ creates: 1, updates: 1, skips: 1 });
    const update = preview.deltas.find((d) => d.kind === "update");
    expect(update).toMatchObject({ before: "300", after: "310" });
  });
});

describe("buildStrengthGoalPreview", () => {
  const goal = (lift: string, target: number): StrengthGoalEntry => ({
    lift,
    goalType: "absolute",
    target,
    unit: "lbs",
    updatedAt: new Date("2026-01-01"),
  });

  it("classifies create / update / skip by goal value", () => {
    const existing = [goal("squat", 400)];
    const incoming = [goal("squat", 405), goal("bench", 275)];
    const preview = buildStrengthGoalPreview(incoming, existing);
    expect(preview).toMatchObject({ creates: 1, updates: 1, skips: 0 });
  });
});

describe("buildProgramSpecPreview", () => {
  const spec = (over: Partial<LiftingProgramSpec> = {}): LiftingProgramSpec => ({
    week: 1,
    offset: 0,
    lift: "back-squat",
    increment: 5,
    order: 1,
    sets: 3,
    reps: 5,
    amrap: false,
    warmUpPct: ".5",
    wtDecrementPct: 0.1,
    activation: "",
    ...over,
  });

  it("keys on week:offset:lift:order and detects config changes", () => {
    expect(programSpecNaturalKey(spec())).toBe("1:0:back-squat:1");
    const existing = [spec({ sets: 3 })];
    const incoming = [spec({ sets: 5 }), spec({ order: 2, lift: "bench-press" })];
    const preview = buildProgramSpecPreview(incoming, existing);
    expect(preview).toMatchObject({ creates: 1, updates: 1, skips: 0 });
  });

  it("treats an identical row as a skip", () => {
    const preview = buildProgramSpecPreview([spec()], [spec()]);
    expect(preview).toMatchObject({ creates: 0, updates: 0, skips: 1 });
  });
});
