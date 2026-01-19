export const CYCLE_NAME_REGEX =
  "Cycle_(?<majorNum>[0-9])\\.(?<minorNum>[0-9])(?:\\.(?<patchNum>[0-9]))?_(?<program>[^_]+)(?:_(?<phase>[^_]+))?";
export const CYCLE_PHASES = ["Leader", "Anchor"];
export const CYCLE_PROGRAMS = ["SSL", "FSL", "531", "5x531", "Deload", "PRT"];
export const CYCLE_SHEET_NAME_REGEX = new RegExp(CYCLE_NAME_REGEX);
export const COPIED_SHEET_NAME_REGEX = new RegExp(
  `Copy of ${CYCLE_NAME_REGEX}`,
);
export const DASH_SHEET_NAME = "DASHBOARD";
export const TOC_SHEET_NAME = "TOC";
export const CYCLE_SHEET_PREFIX = "Cycle_";
export const COPIED_SHEET_PREFIX = "Copy of ";
export const PRIOR_CYCLE_INDEX = "D1";
export const CURRENT_TM_INDEX = "C7:C11";
export const CURRENT_PROGRAM_INDEX = "$B$1";
export const CURRENT_LIFT_INDEX = "$B$2";
export const CURRENT_WEEK_INDEX = "$B$3";
export const PREVIOUS_CYCLE_INDEX = "$B$4";
export const WARMUP_COL_INDEX = 2;
export const COL_HIDE_RANGE = "C1:1";
export const PROG_REF_SHEET_TITLE = "Program_Reference";
export const PROG_REF_ABBRV_COL_TITLE = "Abbreviation";
export const SECTION_HIDE_START_KEY = "Cycle #";
export const SECTION_HIDE_NEXT_KEY = "Percentages";
// const DATE_FORMAT_REGEX = /^(0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-]\d{4}$/;
export const DATE_FORMAT_REGEX =
  "^(0?[1-9]|1[012])[/-](0?[1-9]|[12][0-9]|3[01])[/-][0-9]{4}$";
export const NAMED_RANGE_CLEAN_REGEX = /[^A-Za-z0-9_]/g;
export const SET_REGEX = /Set [0-9]/g;
export const MAIN_LIFT_NAMES = [
  "Squat",
  "Bench Press",
  "Chin-up",
  "Overhead Press",
  "Deadlift",
];
export const RPT_HISTORY_HEADERS = [
  "Program",
  "Cycle #",
  "Workout #",
  "Date",
  "Lift",
  "Set #",
  "Weight",
  "Reps",
  "Notes",
];
export const RPT_NAME_REGEX = "RPT_Week_([0-9]+)_([0-9]+)";
export const SET_REP_SCHEME_REGEX = "([0-9]+)\\s*×\\s*([0-9]+)";
export const DATE_FORMAT_STR = "YYYYMMDD";
export const SET_NAME_REGEX = "^Set\\s*([0-9]+)";
export const TM_SHEET_NAME = "TRAINING_MAXES";
export const RPT_SPEC_SHEET_NAME = "RPT_PROGRAM_SPEC";
export const RPT_HIST_SHEET_NAME = "LIFT_RECORDS";
