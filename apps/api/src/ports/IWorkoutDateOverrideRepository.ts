export interface IWorkoutDateOverrideRepository {
  getOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<Date | null>;

  upsertOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    newDate: Date,
  ): Promise<void>;
}
