export interface ScheduledWorkout {
  workoutNum: number;
  weekNum: number;
  scheduledDate: Date;
}

export interface ICycleScheduledWorkoutRepository {
  getScheduledWorkouts(program: string, cycleNum: number): Promise<ScheduledWorkout[]>;
  saveScheduledWorkouts(program: string, cycleNum: number, workouts: ScheduledWorkout[]): Promise<void>;
}
