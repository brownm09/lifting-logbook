import { UserSettingsResponse, UserWorkoutSchedule } from '@lifting-logbook/types';
import { IUserSettingsRepository } from '../../ports/IUserSettingsRepository';

export class InMemoryUserSettingsRepository implements IUserSettingsRepository {
  private activeProgram: string | null = null;
  private workoutSchedule: UserWorkoutSchedule | null = null;
  private defaultWeightIncrement: number | null = null;

  async getSettings(): Promise<UserSettingsResponse> {
    return {
      activeProgram: this.activeProgram,
      workoutSchedule: this.workoutSchedule,
      defaultWeightIncrement: this.defaultWeightIncrement,
    };
  }

  setSchedule(schedule: UserWorkoutSchedule | null): void {
    this.workoutSchedule = schedule;
  }

  setActiveProgram(program: string | null): void {
    this.activeProgram = program;
  }

  setDefaultWeightIncrement(increment: number | null): void {
    this.defaultWeightIncrement = increment;
  }
}
