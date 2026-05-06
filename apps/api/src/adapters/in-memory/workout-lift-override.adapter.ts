import { LiftOverride, IWorkoutLiftOverrideRepository } from '../../ports/IWorkoutLiftOverrideRepository';

export class InMemoryWorkoutLiftOverrideRepository
  implements IWorkoutLiftOverrideRepository
{
  private readonly store = new Map<string, LiftOverride[]>();

  private key(program: string, cycleNum: number, workoutNum: number): string {
    // Null byte delimiter — program slugs cannot contain \0, unambiguous even for slugs like "5-3-1".
    return `${program}\0${cycleNum}\0${workoutNum}`;
  }

  async getOverrides(
    program: string,
    cycleNum: number,
    workoutNum: number,
  ): Promise<LiftOverride[]> {
    return this.store.get(this.key(program, cycleNum, workoutNum)) ?? [];
  }

  async upsertOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    override: LiftOverride,
  ): Promise<void> {
    const k = this.key(program, cycleNum, workoutNum);
    const existing = this.store.get(k) ?? [];
    const idx = existing.findIndex((o) => o.lift === override.lift);
    if (idx >= 0) {
      existing[idx] = override;
    } else {
      existing.push(override);
    }
    this.store.set(k, existing);
  }

  async deleteOverride(
    program: string,
    cycleNum: number,
    workoutNum: number,
    lift: string,
  ): Promise<void> {
    const k = this.key(program, cycleNum, workoutNum);
    const existing = this.store.get(k) ?? [];
    this.store.set(
      k,
      existing.filter((o) => o.lift !== lift),
    );
  }
}
