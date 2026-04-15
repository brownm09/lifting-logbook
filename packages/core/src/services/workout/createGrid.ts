import { WARMUP_BASE_REPS } from "@src/core";

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
  let progSpecLiftName,
    progSpecOffset,
    progSpecWarmPcts,
    progSpecWorkPcts,
    progSpecActivExName,
    progSpecIncrement,
    progSpecWtDec,
    progSpecNumSets;
  const liftDate = new Date();
  const CYCLE_SHEET_HEADER = ["Program", "", "Cycle", ""];
  const MINI_PROG_SPEC_HEADERS = ["Core Lift", "TM", "Activ. Ex.", "Inc. Amt."];
  const MINI_WORKOUT_HEADERS = [["Lift", "Weight", "Reps", "Extra"]];
  const resultGrid = [];
  const tmGrid = [CYCLE_SHEET_HEADER, MINI_PROG_SPEC_HEADERS];
  let rowOffset;
  for (let i = 1; i < tmData.length; i++) {
    console.log(`Training max: ${tmData[i]}`);
    for (let j = 0; j < progSpecData.length; j++) {
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
        for (let k = 0; k < progSpecWarmPcts.length; k++) {
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
        for (let k = 0; k < progSpecWorkPcts.length; k++) {
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
