import { WARMUP_BASE_REPS } from "../constants/config";
import { LiftRecord } from "../models/LiftRecord";
import { addDaysUTC, formatDateYYYYMMDD } from "../utils/jsUtil";

/**
 * Greate a cycle grid using training max data and a program spec (typed version).
 * @param {RptProgramSpec[]} progSpecData
 * @param {TrainingMax[]} tmData
 * @param {Date} startDate
 * @returns {any[][]}
 */
export function createGridV2(progSpecData, tmData, startDate) {
  // Constants for headers and formatting
  const LIFT_DATE_HEADER = "Lift Date";
  const WORKOUT_SHEET_HEADERS = ["Program", "", "Cycle", "", "Weight", ""];
  const LIFT_SPEC_HEADERS = [
    "Core Lift",
    "Scheme",
    "TM",
    "Inc. Amt.",
    "Activ. Ex.",
    LIFT_DATE_HEADER,
  ];
  const LIFT_PLAN_HEADERS = ["Date", "Lift", "Set", "Weight", "Reps", "Notes"];
  let resultGrid: any[][] = [];

  resultGrid.push(WORKOUT_SHEET_HEADERS);
  let progSpecGrid: any[][] = [];
  progSpecGrid.push(LIFT_SPEC_HEADERS);
  let workoutGrid: any[][] = [];
  workoutGrid.push(LIFT_PLAN_HEADERS);

  // console.log(`Program spec data: \n\t${progSpecData.join('\n\t')}`)
  // console.log(`Training max data: \n\t${tmData.join('\n\t')}`)

  for (let i = 0; i < tmData.length; i++) {
    const tm = tmData[i];
    // console.log(`Training max: ${tm.lift}, ${tm.weight}`);
    for (let j = 0; j < progSpecData.length; j++) {
      const ps = progSpecData[j];
      // console.log(`Program spec: ${ps.lift}, ${ps.offset}, ${ps.sets}, ${ps.reps}, ${ps.warmUpPct}, ${ps.wtDecrementPct}`);
      if (ps.lift === tm.lift && ps.offset >= 0) {
        const liftSpec = generateLiftSpec(tm, ps, startDate);
        progSpecGrid.push(liftSpec);
        const liftPlan = generateLiftPlan(tm, ps, startDate);
        workoutGrid.push(...liftPlan);
      }
    }
  }

  resultGrid.push(...progSpecGrid, ...workoutGrid);
  return resultGrid;
}

/**
 * Creates a lift specification from a training max and program spec.
 * @param {TrainingMax} tm
 * @param {RptProgramSpec} ps
 * @param {Date} startDate
 * @return {any[]}
 */
export function generateLiftSpec(tm, ps, startDate) {
  // console.log(`Offset for ${ps.lift}: ${ps.offset}`);
  let liftDate = addDaysUTC(startDate, ps.offset);
  // console.log(`Original start date: ${formatDateYYYYMMDD(startDate)}; offset date: ${formatDateYYYYMMDD(liftDate)}`);
  return [
    ps.lift,
    `${ps.sets} × ${ps.reps}`,
    tm.weight,
    ps.increment,
    formatDateYYYYMMDD(liftDate),
    ps.activation,
  ];
}

/**
 * Creates a lift plan from a training max and program spec.
 * @param {TrainingMax} tm
 * @param {RptProgramSpec} ps
 * @param {Date} startDate
 * @return {any[]}
 */
export function generateLiftPlan(tm, ps, startDate) {
  let workoutGrid: any[][] = [];
  const LIFT_DATE_HEADER = "Lift Date";
  const WARMUP_BASE_REPS = 5;
  const progSpecLiftName = ps.lift;
  const progSpecNumSets = ps.sets;
  const progSpecIncrement = ps.increment;
  const progSpecWtDec = ps.wtDecrementPct;
  // Warm-up percentages
  const progSpecWarmPcts = `${ps.warmUpPct}`
    .split(",")
    .map((pct) => parseFloat(pct));
  // Work set percentages
  const progSpecWorkPcts = Array(progSpecNumSets)
    .fill(1)
    .reduce((acc, num) => {
      acc.push(num - acc.length * progSpecWtDec);
      return acc;
    }, [] as number[]);
  for (let k = 0; k < progSpecWarmPcts.length; k++) {
    workoutGrid.push([
      `=INDEX(A1:F, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("${LIFT_DATE_HEADER}", A2:2, 0))`,
      progSpecLiftName,
      `Warm-up ${k + 1}`,
      `=MROUND(PRODUCT(INDEX(A1:D, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("TM", A2:2, 0)), ${progSpecWarmPcts[k]}), ${progSpecIncrement})`,
      WARMUP_BASE_REPS - k,
      "",
    ]);
  }
  for (let k = 0; k < progSpecWorkPcts.length; k++) {
    workoutGrid.push([
      `=INDEX(A1:F, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("${LIFT_DATE_HEADER}", A2:2, 0))`,
      progSpecLiftName,
      `Set ${k + 1}`,
      `=MROUND(PRODUCT(INDEX(A1:D, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("TM", A2:2, 0)), ${progSpecWorkPcts[k]}), ${progSpecIncrement})`,
      "",
      "",
    ]);
  }
  return workoutGrid;
}

/**
 *
 */
export function extractLiftRecords(data: any[][]): LiftRecord[] {
  if (!data || data.length < 2) return [];
  // Extract program and cycle from the first few rows (look for 'Program' and 'Cycle' headers)
  let program: string | undefined = undefined;
  let cycleNum: number | undefined = undefined;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      for (let j = 0; j < row.length; j++) {
        if (typeof row[j] === "string" && row[j].trim() === "Program") {
          program = row[j + 1] !== undefined ? String(row[j + 1]) : undefined;
        }
        if (typeof row[j] === "string" && row[j].trim() === "Cycle") {
          const val = row[j + 1];
          if (val !== undefined && val !== "") {
            const num = Number(val);
            if (!isNaN(num)) cycleNum = num;
          }
        }
      }
    }
  }
  // Enforce required fields
  if (!program || cycleNum === undefined) {
    throw new Error(
      `Missing required program or cycle number in lift records data.`,
    );
  }
  // Find the header row for lift records
  const headerIdx = data.findIndex(
    (row) =>
      Array.isArray(row) &&
      row.length >= 6 &&
      row[0] === "Date" &&
      row[1] === "Lift" &&
      row[2] === "Set",
  );
  if (headerIdx === -1) throw new Error("Lift records header row not found.");
  const headers = data[headerIdx];
  const records: LiftRecord[] = [];
  // Map of date string to workout number (incremented as new dates are found)
  const dateToWorkoutNum = new Map<string, number>();
  let workoutCounter = 1;
  // Process rows after header
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;
    // Check for required fields (all except Notes)
    const requiredIdxs = [0, 1, 2, 3]; // Date, Lift, Set, Weight
    let missingRequired = false;
    for (const idx of requiredIdxs) {
      if (row[idx] === undefined || row[idx] === "") {
        missingRequired = true;
        throw new Error(
          `Missing required field '${headers[idx]}' at row ${headerIdx + i + 1}, column ${idx + 1}`,
        );
      }
    }
    // if (missingRequired) continue;
    // Exclude warm-up sets
    const setVal = row[2];
    if (
      typeof setVal === "string" &&
      setVal.trim().toLowerCase().startsWith("warm-up")
    ) {
      continue;
    }
    // Exclude skipped work sets
    const repVal = row[4];
    if (repVal === undefined || repVal === "" || Number(repVal) === 0) {
      continue;
    }
    // Determine workoutNum from date
    const dateStr = String(row[0]);
    let workoutNum: number;
    if (dateToWorkoutNum.has(dateStr)) {
      workoutNum = dateToWorkoutNum.get(dateStr)!;
    } else {
      workoutNum = workoutCounter++;
      dateToWorkoutNum.set(dateStr, workoutNum);
    }
    // Map row to LiftRecord
    const rec: any = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      let value = row[j];
      switch (key) {
        case "Set":
          const currSetMatch = value.match(/Set\s*(\d+)/i);
          if (currSetMatch) {
            rec.setNum = Number(currSetMatch[1]);
          } else {
            throw new Error(
              `Invalid Set string format at row ${headerIdx + i + 1}: ${value}`,
            );
          }
          break;
        case "Weight":
        case "Reps":
          rec[key.trim().toLowerCase()] = Number(value);
          break;
        default:
          rec[key.trim().toLowerCase()] = value;
          break;
      }
      // rec[`${LIFT_RECORD_HEADER_MAP[key]}`] = value;
    }
    // Add required program and cycleNum
    rec.program = program;
    rec.cycleNum = cycleNum;
    rec.workoutNum = workoutNum;
    records.push(rec as LiftRecord);
  }
  return records;
}

/**
 * Greate a cycle grid using training max data and a program spec.
 * @param {any[][]} progSpecData Program spec data values
 * @param {any[][]} tmData Training max data values
 * @param {Date} startDate Date of first workout in cycle
 */
export function createGrid(progSpecData, tmData, startDate) {
  // const TM_DATE_COL_NUM = tmData[0].indexOf("Date Updated");
  const TM_LIFT_COL_NUM = tmData[0].indexOf("Lift");
  const TM_WT_COL_NUM = tmData[0].indexOf("Weight");
  const PS_OFFSET_COL_NUM = progSpecData[0].indexOf("Offset");
  const PS_LIFT_COL_NUM = progSpecData[0].indexOf("Lift");
  const PS_INC_COL_NUM = progSpecData[0].indexOf("Increment");
  const PS_ORD_COL_NUM = progSpecData[0].indexOf("Order");
  const PS_SETS_COL_NUM = progSpecData[0].indexOf("Sets");
  const PS_REPS_COL_NUM = progSpecData[0].indexOf("Reps");
  const PS_WARM_COL_NUM = progSpecData[0].indexOf("Warm-Up %");
  const PS_WORK_COL_NUM = progSpecData[0].indexOf("WT Decrement %");
  const PS_ACTIVEX_COL_NUM = progSpecData[0].indexOf("Activation");
  var progSpecLiftName,
    progSpecOffset,
    progSpecWarmPcts,
    progSpecWorkPcts,
    progSpecActivExName,
    progSpecIncrement,
    progSpecWtDec,
    progSpecNumSets,
    liftDate = new Date();
  const BASE_TM_REF_OFFSET = 2;
  const CYCLE_SHEET_HEADER = ["Program", "", "Cycle", ""];
  const MINI_PROG_SPEC_HEADERS = ["Core Lift", "TM", "Activ. Ex.", "Inc. Amt."];
  const MINI_WORKOUT_HEADERS = [["Lift", "Weight", "Reps", "Extra"]];
  var resultGrid = [];
  var tmGrid = [CYCLE_SHEET_HEADER, MINI_PROG_SPEC_HEADERS];
  var rowOffset;
  for (var i = 1; i < tmData.length; i++) {
    console.log(`Training max: ${tmData[i]}`);
    for (var j = 0; j < progSpecData.length; j++) {
      if (
        progSpecData[j][PS_LIFT_COL_NUM] === tmData[i][TM_LIFT_COL_NUM] &&
        progSpecData[j][PS_OFFSET_COL_NUM] >= 0
      ) {
        liftDate.setTime(startDate.getTime());
        progSpecLiftName = progSpecData[j][PS_LIFT_COL_NUM];
        progSpecActivExName = progSpecData[j][PS_ACTIVEX_COL_NUM];
        console.log(`Program spec: ${progSpecData[j]}`);
        progSpecOffset = progSpecData[j][PS_OFFSET_COL_NUM];
        progSpecNumSets = progSpecData[j][PS_SETS_COL_NUM];
        progSpecIncrement = progSpecData[j][PS_INC_COL_NUM];
        progSpecWtDec = progSpecData[j][PS_WORK_COL_NUM];
        liftDate.setDate(liftDate.getDate() + progSpecOffset);
        tmGrid.push([
          progSpecLiftName,
          tmData[i][TM_WT_COL_NUM],
          progSpecActivExName,
          progSpecIncrement,
        ]);
        progSpecWarmPcts = `${progSpecData[j][PS_WARM_COL_NUM]}`
          .split(",")
          .map((pct) => {
            return parseFloat(pct);
          });
        Logger.log(`Set count: ${progSpecNumSets}`);
        progSpecWorkPcts = Array(progSpecNumSets)
          .fill(1)
          .reduce((acc, num) => {
            acc.push(num - acc.length * progSpecWtDec);
            return acc;
          }, []);
        Logger.log(`Work pcts: ${progSpecWorkPcts}`);
        // progSpecWorkPcts =
        // for (let iW = progSpecNumSets; iW > 1; iW--) {
        //   progSpecWorkPcts.push(progSpecWorkPcts[progSpecWorkPcts.length - 1] - progSpecWtDec)
        // }
        // progSpecWorkPcts = `${progSpecWtDec}`
        // .split(",")
        // progSpecWorkPcts.map((pct) => {
        //   return parseFloat(pct);
        // });
        if (progSpecData[j][PS_ORD_COL_NUM] === 1) {
          rowOffset = resultGrid.length;
        }
        resultGrid.push([
          progSpecData[j][PS_LIFT_COL_NUM],
          `${progSpecNumSets} × ${progSpecData[j][PS_REPS_COL_NUM]}`,
          progSpecData[j][PS_ORD_COL_NUM] === 1
            ? liftDate.toLocaleDateString()
            : `=INDIRECT("R[-${resultGrid.length - rowOffset}]C", FALSE)`,
          "Notes",
        ]);
        // workoutGrids[progSpecLiftName] = [];
        for (var k = 0; k < progSpecWarmPcts.length; k++) {
          // workoutGrids[progSpecLiftName].push([
          //=MROUND(PRODUCT($B$3, 0.4), 2.5)
          //=MROUND(PRODUCT(INDEX(A1:D, MATCH("Deadlift", A1:A, 0), MATCH("TM", A2:2, 0)), 0.4), 2.5)
          resultGrid.push([
            `Warm-up ${k + 1}`,
            // `=MROUND(PRODUCT($B$${BASE_TM_REF_OFFSET + i}, ${progSpecWarmPcts[k]}), 2.5)`,
            `=MROUND(PRODUCT(INDEX(A1:D, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("TM", A2:2, 0)), ${progSpecWarmPcts[k]}), ${progSpecIncrement})`,
            WARMUP_BASE_REPS - k,
            "",
          ]);
        }
        for (var k = 0; k < progSpecWorkPcts.length; k++) {
          // workoutGrids[progSpecLiftName].push([
          resultGrid.push([
            `Set ${k + 1}`,
            // `=MROUND(PRODUCT($B$${BASE_TM_REF_OFFSET + i}, ${progSpecWorkPcts[k]}), 2.5)`,
            `=MROUND(PRODUCT(INDEX(A1:D, MATCH("${progSpecLiftName}", A1:A, 0), MATCH("TM", A2:2, 0)), ${progSpecWorkPcts[k]}), ${progSpecIncrement})`,
            "",
            "",
          ]);
        }
      }
    }
  }
  return tmGrid.concat(MINI_WORKOUT_HEADERS, resultGrid);
}
