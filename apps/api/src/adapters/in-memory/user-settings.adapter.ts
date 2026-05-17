import { UserSettingsResponse, UserWorkoutSchedule } from '@lifting-logbook/types';
import { IUserSettingsRepository } from '../../ports/IUserSettingsRepository';

export class InMemoryUserSettingsRepository implements IUserSettingsRepository {
  private activeProgram: string | null = null;
  private workoutSchedule: UserWorkoutSchedule | null = null;

  async getSettings(): Promise<UserSettingsResponse> {
    return { activeProgram: this.activeProgram, workoutSchedule: this.workoutSchedule };
  }

  setSchedule(schedule: UserWorkoutSchedule | null): void {
    this.workoutSchedule = schedule;
  }

  setActiveProgram(program: string | null): void {
    this.activeProgram = program;
  }
}
