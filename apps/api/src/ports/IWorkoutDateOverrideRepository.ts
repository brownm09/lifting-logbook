export interface IWorkoutDateOverrideRepository {
  getOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<Date | null>;

  getOverridesForCycle(
    program: string,
    cycleNum: number,
  ): Promise<Map<number, Date>>;

  upsertOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    newDate: Date,
  ): Promise<void>;
}
