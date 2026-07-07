import { UserSettingsResponse, UserWorkoutSchedule, WeightUnit } from '@lifting-logbook/types';
import { IUserSettingsRepository } from '../../ports/IUserSettingsRepository';

export class InMemoryUserSettingsRepository implements IUserSettingsRepository {
  private activeProgram: string | null = null;
  private workoutSchedule: UserWorkoutSchedule | null = null;
  private defaultWeightIncrement: number | null = null;
  private unit: WeightUnit | null = null;

  async getSettings(): Promise<UserSettingsResponse> {
    return {
      activeProgram: this.activeProgram,
      workoutSchedule: this.workoutSchedule,
      defaultWeightIncrement: this.defaultWeightIncrement,
      unit: this.unit,
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

  setUnit(unit: WeightUnit | null): void {
    this.unit = unit;
  }
}
