export interface IWorkoutSkipOverrideRepository {
  getSkipsForCycle(program: string, cycleNum: number): Promise<Set<number>>;
  skipWorkout(program: string, cycleNum: number, workoutNum: number, reason?: string): Promise<void>;
  unskipWorkout(program: string, cycleNum: number, workoutNum: number): Promise<void>;
}
