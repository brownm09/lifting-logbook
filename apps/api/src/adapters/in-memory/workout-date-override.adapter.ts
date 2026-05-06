import { IWorkoutDateOverrideRepository } from '../../ports/IWorkoutDateOverrideRepository';

export class InMemoryWorkoutDateOverrideRepository
  implements IWorkoutDateOverrideRepository
{
  private readonly store = new Map<string, Date>();

  private key(program: string, cycleNum: number, workoutNum: number): string {
    // Use null byte as delimiter — program slugs cannot contain \0, so this is unambiguous
    // even for slugs like "5-3-1" that contain hyphens.
    return `${program}\0${cycleNum}\0${workoutNum}`;
  }

  async getOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<Date | null> {
    return this.store.get(this.key(program, cycleNum, workoutNum)) ?? null;
  }

  async upsertOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    newDate: Date,
  ): Promise<void> {
    this.store.set(this.key(program, cycleNum, workoutNum), newDate);
  }
}
