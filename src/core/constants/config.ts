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
  "TM",
  LIFT_DATE_HEADER,
  "Activ. Ex.",
];
export const LIFT_PLAN_HEADERS = [
  DATE_HEADER,
  LIFT_HEADER,
  SET_HEADER,
  SPEC_WEIGHT_HEADER,
  REPS_HEADER,
  NOTES_HEADER,
];

export const PROG_SPEC_WARMUP_PCTS = (
  warmUpPcts: string,
  delimiter: string = ",",
) => `${warmUpPcts.trim()}`.split(delimiter).map((pct) => parseFloat(pct));

export const MROUND = (number: number, multiple: number) => {
  return Math.round(number / multiple) * multiple;
};

export const PROG_SPEC_WORK_PCTS = (
  numSets: number,
  wtDecrementPct: number,
) => {
  return Array(numSets)
    .fill(1)
    .reduce((acc, num) => {
      acc.push(num - acc.length * wtDecrementPct);
      return acc;
    }, []);
};
