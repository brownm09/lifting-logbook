import {
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
 * @param {LiftingProgramSpec[]} progSpecData
 * @param {TrainingMax[]} tmData
 * @param {Date} startDate
 * @returns {any[][]}
 */

export function createGridV2(
  progSpecData: LiftingProgramSpec[],
  tmData: TrainingMax[],
  startDate: Date,
) {
  // console.log(
  //   `Creating grid with ${progSpecData.length} lift specs and ${tmData.length} training maxes starting from ${startDate.toISOString()}.`,
  // );

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
