import {
  CycleDashboard,
  LIFT_PLAN_HEADERS,
  LIFT_SPEC_HEADERS,
  LiftingProgramSpec,
  TrainingMax,
  WORKOUT_SHEET_HEADERS,
} from "@src/core";
import { generateLiftPlan } from "./generateLiftPlan";
import { generateLiftSpec } from "./generateLiftSpec";

/**
 * Greate a cycle grid using training max data and a program spec (typed version).
 * @param {CycleDashboard} cycleDashboard
 * @param {LiftingProgramSpec[]} progSpecData
 * @param {TrainingMax[]} tmData
 * @returns {any[][]}
 */

export function createGridV2(
  cycleDashboard: CycleDashboard,
  progSpecData: LiftingProgramSpec[],
  tmData: TrainingMax[],
) {
  console.log(
    `Creating grid with ${progSpecData.length} lift specs and ${tmData.length} training maxes starting from ${cycleDashboard.cycleDate.toISOString()}.`,
  );

  const resultGrid: any[][] = [];

  resultGrid.push(WORKOUT_SHEET_HEADERS);
  resultGrid[0][1] = cycleDashboard.program;
  resultGrid[0][3] = cycleDashboard.cycleNum;
  // resultGrid[0][5] = cycleDashboard.weight;
  const progSpecGrid: any[][] = [];
  progSpecGrid.push(LIFT_SPEC_HEADERS);
  const workoutGrid: any[][] = [];
  workoutGrid.push(LIFT_PLAN_HEADERS);

  // console.log(`Program spec data: \n\t${progSpecData.join('\n\t')}`)
  // console.log(`Training max data: \n\t${tmData.join('\n\t')}`)
  progSpecData.forEach((ps) => {
    console.log(
      `Program spec: ${ps.lift}, ${ps.offset}, ${ps.sets}, ${ps.reps}, ${ps.warmUpPct}, ${ps.wtDecrementPct}`,
    );
    if (ps.offset >= 0) {
      const tm = tmData.find((t) => t.lift === ps.lift);
      if (tm) {
        console.log(`Training max: ${tm.lift}, ${tm.weight}`);
        const liftSpec = generateLiftSpec(tm, ps, cycleDashboard.cycleDate);
        progSpecGrid.push(liftSpec);
        const liftPlan = generateLiftPlan(tm, ps, cycleDashboard.cycleDate);
        workoutGrid.push(...liftPlan);
      }
    }
  });

  resultGrid.push(...progSpecGrid, ...workoutGrid);
  return resultGrid;
}
