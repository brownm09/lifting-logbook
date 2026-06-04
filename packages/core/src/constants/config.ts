// Dashboard CSV/Sheet property keys
export const PROGRAM_KEY = "Program";
export const CYCLE_UNIT_KEY = "Cycle Unit";
export const CYCLE_NUM_KEY = "Cycle #";
export const CYCLE_DATE_KEY = "Cycle Date";
export const SHEET_NAME_KEY = "Sheet Name";
export const CYCLE_START_WEEKDAY_KEY = "Start Weekday";
// Configuration constants for core logic

export const WARMUP_BASE_REPS = 5;

// Constants for headers and formatting
export const CORE_LIFT_HEADER = "Core Lift";
export const SPEC_WEIGHT_HEADER = "TM";
export const LIFT_DATE_HEADER = "Lift Date";
export const LIFT_WEIGHT_HEADER = "Weight";
export const DATE_HEADER = "Date";
export const LIFT_HEADER = "Lift";
export const SET_HEADER = "Set";
export const REPS_HEADER = "Reps";
export const NOTES_HEADER = "Notes";
export const WORKOUT_SHEET_HEADERS = ["Program", "", "Cycle", "", "Weight", ""];
export const LIFT_SPEC_HEADERS = [
  CORE_LIFT_HEADER,
  "Scheme",
  "Inc. Amt.",
  SPEC_WEIGHT_HEADER,
  LIFT_DATE_HEADER,
  "Activ. Ex.",
];
export const LIFT_PLAN_HEADERS = [
  DATE_HEADER,
  LIFT_HEADER,
  SET_HEADER,
  LIFT_WEIGHT_HEADER,
  REPS_HEADER,
  NOTES_HEADER,
];

export const PROG_SPEC_WARMUP_PCTS = (
  warmUpPcts: string,
  delimiter: string = ",",
) =>
  `${warmUpPcts}`
    .trim()
    .split(delimiter)
    .map((pct) => parseFloat(pct));

export const MROUND = (number: number, multiple: number) => {
  // A zero multiple (e.g. a custom program saved with increment 0) would divide
  // by zero and yield NaN. Degrade safely to the unrounded value instead.
  if (multiple === 0) return number;
  return Math.round(number / multiple) * multiple;
};

export const PROG_SPEC_WORK_PCTS = (
  numSets: number,
  wtDecrementPct: number,
) => {
  // Each set i gets work percentage (1 - i * wtDecrementPct). When wtDecrementPct
  // is large relative to numSets the final set goes negative, which would produce
  // a negative prescribed weight. Reject rather than silently emit bad sets.
  const minPct = 1 - (numSets - 1) * wtDecrementPct;
  if (minPct < 0) {
    throw new RangeError(
      `wtDecrementPct ${wtDecrementPct} produces a negative work percentage ` +
        `(${minPct}) over ${numSets} sets; it must be at most ${1 / (numSets - 1)}.`,
    );
  }
  return Array(numSets)
    .fill(1)
    .reduce((acc, num) => {
      acc.push(num - acc.length * wtDecrementPct);
      return acc;
    }, []);
};
