import { ICycleScheduledWorkoutRepository, ScheduledWorkout } from '../../ports/ICycleScheduledWorkoutRepository';

export class InMemoryCycleScheduledWorkoutRepository implements ICycleScheduledWorkoutRepository {
  private readonly store = new Map<string, ScheduledWorkout[]>();

  private key(program: string, cycleNum: number): string {
    return `${program}:${cycleNum}`;
  }

  async getScheduledWorkouts(program: string, cycleNum: number): Promise<ScheduledWorkout[]> {
    return this.store.get(this.key(program, cycleNum)) ?? [];
  }

  async saveScheduledWorkouts(program: string, cycleNum: number, workouts: ScheduledWorkout[]): Promise<void> {
    this.store.set(this.key(program, cycleNum), [...workouts]);
  }
}
