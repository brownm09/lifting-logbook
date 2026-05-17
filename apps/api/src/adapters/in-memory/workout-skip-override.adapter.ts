import { IWorkoutSkipOverrideRepository } from '../../ports/IWorkoutSkipOverrideRepository';

export class InMemoryWorkoutSkipOverrideRepository implements IWorkoutSkipOverrideRepository {
  private readonly store = new Map<string, Set<number>>();

  private key(program: string, cycleNum: number): string {
    return `${program}:${cycleNum}`;
  }

  async getSkipsForCycle(program: string, cycleNum: number): Promise<Set<number>> {
    return new Set(this.store.get(this.key(program, cycleNum)) ?? []);
  }

  async skipWorkout(program: string, cycleNum: number, workoutNum: number): Promise<void> {
    const k = this.key(program, cycleNum);
    const set = this.store.get(k) ?? new Set<number>();
    set.add(workoutNum);
    this.store.set(k, set);
  }

  async unskipWorkout(program: string, cycleNum: number, workoutNum: number): Promise<void> {
    this.store.get(this.key(program, cycleNum))?.delete(workoutNum);
  }
}
