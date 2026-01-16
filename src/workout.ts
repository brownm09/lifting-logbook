/**
 * Greate a cycle grid using training max data and a program spec (typed version).
 * @param {RptProgramSpec[]} progSpecData
 * @param {TrainingMax[]} tmData
 * @param {Date} startDate
 * @returns {any[][]}
 */
import { formatDateYYYYMMDD, addDaysUTC } from './jsUtil';

function createGridV2(progSpecData, tmData, startDate) {
  // Constants for headers and formatting
  const LIFT_DATE_HEADER = "Lift Date";
  const WORKOUT_SHEET_HEADERS = ["Program", "", "Cycle", "", "Weight", ""];
  const LIFT_SPEC_HEADERS = ["Core Lift", "Scheme", "TM", "Inc. Amt.", "Activ. Ex.", LIFT_DATE_HEADER];
  const LIFT_PLAN_HEADERS = ["Date", "Lift", "Set", "Weight", "Reps", "Notes"];
  let resultGrid: any[][] = [];
  
  resultGrid.push(WORKOUT_SHEET_HEADERS)
  let progSpecGrid: any[][] = [];
  progSpecGrid.push(LIFT_SPEC_HEADERS);
  let workoutGrid : any[][] = [];
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
function generateLiftSpec(tm, ps, startDate) {
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
function generateLiftPlan(tm, ps, startDate) {
  let workoutGrid: any[][] = [];
  const LIFT_DATE_HEADER = "Lift Date";
  const WARMUP_BASE_REPS = 5;
  const progSpecLiftName = ps.lift;
  const progSpecNumSets = ps.sets;
  const progSpecIncrement = ps.increment;
  const progSpecWtDec = ps.wtDecrementPct;
  // Warm-up percentages
  const progSpecWarmPcts = `${ps.warmUpPct}`.split(",").map((pct) => parseFloat(pct));
  // Work set percentages
  const progSpecWorkPcts = Array(progSpecNumSets).fill(1).reduce((acc, num) => {
    acc.push(num - (acc.length * progSpecWtDec));
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
 * Greate a cycle grid using training max data and a program spec.
 * @param {any[][]} progSpecData Program spec data values
 * @param {any[][]} tmData Training max data values
 * @param {Date} startDate Date of first workout in cycle
 */
function createGrid(progSpecData, tmData, startDate) {
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
  var progSpecLiftName, progSpecOffset, progSpecWarmPcts, progSpecWorkPcts, progSpecActivExName, progSpecIncrement, progSpecWtDec, progSpecNumSets, liftDate = new Date();
  const BASE_TM_REF_OFFSET = 2;
  const CYCLE_SHEET_HEADER = ["Program", "", "Cycle", ""]
  const MINI_PROG_SPEC_HEADERS = ["Core Lift", "TM", "Activ. Ex.", "Inc. Amt."]
  const MINI_WORKOUT_HEADERS = [["Lift", "Weight", "Reps", "Extra"]];
  var resultGrid = [];
  var tmGrid = [CYCLE_SHEET_HEADER, MINI_PROG_SPEC_HEADERS];
  var rowOffset;
  for (var i = 1; i < tmData.length; i++) {
    console.log(`Training max: ${tmData[i]}`);
    for (var j = 0; j < progSpecData.length; j++) {
      if (progSpecData[j][PS_LIFT_COL_NUM] === tmData[i][TM_LIFT_COL_NUM] && progSpecData[j][PS_OFFSET_COL_NUM] >= 0) {
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
        progSpecWorkPcts = Array(progSpecNumSets).fill(1).reduce((acc, num) => {
          acc.push(num - (acc.length * progSpecWtDec));
          return acc;
        }, []);
        Logger.log(`Work pcts: ${progSpecWorkPcts}`)
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
          progSpecData[j][PS_ORD_COL_NUM] === 1 ? liftDate.toLocaleDateString() : `=INDIRECT("R[-${resultGrid.length - rowOffset}]C", FALSE)`,
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


// For Node.js/CommonJS compatibility in tests and local dev
export { createGridV2, generateLiftSpec, generateLiftPlan };
