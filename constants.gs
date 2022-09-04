const TOC_SHEET_NAME = "TOC";
const CYCLE_SHEET_PREFIX = "Cycle_";
const COPIED_SHEET_PREFIX = "Copy of ";
const PRIOR_CYCLE_INDEX = "D1";
const CURRENT_TM_INDEX = "C7:C11";
const DATE_FORMAT_REGEX = /^(0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-]\d{4}$/;
const NAMED_RANGE_CLEAN_REGEX = /[^A-Za-z0-9_]/g;
const MAIN_LIFT_NAMES = ["Squat", "Bench Press", "Chin-up", "Overhead Press", "Deadlift"];