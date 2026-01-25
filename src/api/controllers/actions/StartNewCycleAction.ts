import { MSG_SUCCESS_TOAST_NEW_CYCLE } from "@src/api/constants/constants";
import {
  CycleDashboardRepository,
  LiftRecordRepository,
  LiftingProgramSpecRepository,
  SheetRepository,
  TrainingMaxRepository,
  WorkoutRepository,
} from "@src/api/repositories";
import { WorkoutView, runWithErrorHandling } from "@src/api/ui";
import {
  CycleDashboard,
  LiftRecord,
  LiftingProgramSpec,
  TrainingMax,
} from "@src/core/models";
import {
  createGridV2,
  extractLiftRecords,
  updateCycle,
  updateMaxes,
} from "@src/core/services";

/**
 * Route: Logic for starting a new cycle in the lifting program
 */
export class StartNewCycleAction {
  run() {
    runWithErrorHandling(() => {
      const dashboardRepo = new CycleDashboardRepository();
      const programRepo = new LiftingProgramSpecRepository();
      const trainingMaxRepo = new TrainingMaxRepository();
      const sheetRepository = new SheetRepository();

      const dashboard: CycleDashboard = dashboardRepo.getCycleDashboard();
      const programSpec: LiftingProgramSpec[] =
        programRepo.getLiftingProgramSpec();
      const trainingMaxes: TrainingMax[] = trainingMaxRepo.getTrainingMaxes();
      const liftRecordRepo = new LiftRecordRepository();

      const workoutRepo = new WorkoutRepository(dashboard.sheetName);
      const workoutData = workoutRepo.getWorkout();
      const newLiftRecords: LiftRecord[] = extractLiftRecords(workoutData);

      const newCycle: CycleDashboard = updateCycle(dashboard);
      console.log(`New cycle generated: ${JSON.stringify(newCycle)}.`);
      const newTrainingMaxes = updateMaxes(
        programSpec,
        trainingMaxes,
        newLiftRecords,
      );
      const newWorkout = createGridV2(
        programSpec,
        newTrainingMaxes,
        newCycle.cycleDate,
      );

      liftRecordRepo.appendLiftRecords(newLiftRecords);
      trainingMaxRepo.setTrainingMaxes(newTrainingMaxes);

      const newWorkoutSheet = sheetRepository.createTableSheet(
        newCycle.sheetName,
        newWorkout,
      );
      // const newWorkoutRepo = new WorkoutRepository(newCycle.sheetName);
      dashboardRepo.setCycleDashboard(newCycle);

      const toastMsg = MSG_SUCCESS_TOAST_NEW_CYCLE(newCycle.sheetName, newLiftRecords.length);

      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
      SpreadsheetApp.setActiveSheet(newWorkoutSheet);
      WorkoutView.formatWorkoutSheet(newWorkout, newWorkoutSheet);
      workoutRepo.hideSheet();
    });
  }
}
