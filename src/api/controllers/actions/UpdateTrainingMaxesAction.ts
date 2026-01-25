import {
  CycleDashboardRepository,
  LiftRecordRepository,
  LiftingProgramSpecRepository,
  TrainingMaxRepository,
  WorkoutRepository,
  runWithErrorHandling,
} from "@src/api";
import { MSG_SUCCESS_TOAST_UPDATED_MAXES } from "@src/api/constants/constants";
import {
  CycleDashboard,
  LiftRecord,
  LiftingProgramSpec,
  TrainingMax,
} from "@src/core/models";
import { extractLiftRecords, updateMaxes } from "@src/core/services";

// For formatting workout sheets
export class UpdateTrainingMaxesAction {
  run() {
    runWithErrorHandling(() => {
      const dashboardRepo = new CycleDashboardRepository();
      const programRepo = new LiftingProgramSpecRepository();
      const trainingMaxRepo = new TrainingMaxRepository();
      const dashboard: CycleDashboard = dashboardRepo.getCycleDashboard();
      const programSpec: LiftingProgramSpec[] =
        programRepo.getLiftingProgramSpec();
      const trainingMaxes: TrainingMax[] = trainingMaxRepo.getTrainingMaxes();
      const liftRecordRepo = new LiftRecordRepository();

      const workoutRepo = new WorkoutRepository(dashboard.sheetName);
      const workoutData = workoutRepo.getWorkout();
      const newLiftRecords: LiftRecord[] = extractLiftRecords(workoutData);

      const newTrainingMaxes = updateMaxes(
        programSpec,
        trainingMaxes,
        newLiftRecords,
      );
      trainingMaxRepo.setTrainingMaxes(newTrainingMaxes);
      const toastMsg = MSG_SUCCESS_TOAST_UPDATED_MAXES;
      console.log(toastMsg);
      SpreadsheetApp.getActiveSpreadsheet().toast(toastMsg, "Success");
    });
  }
}
