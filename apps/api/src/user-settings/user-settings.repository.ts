import { Prisma, PrismaClient } from '@prisma/client';
import {
  UserSettingsResponse,
  UserWorkoutSchedule,
  isValidSchedule,
} from '@lifting-logbook/types';
import { IUserSettingsRepository } from '../ports/IUserSettingsRepository';

export interface UpsertSettingsPatch {
  activeProgram?: string;
  // Explicit `null` clears the schedule; `undefined` leaves it unchanged.
  workoutSchedule?: UserWorkoutSchedule | null;
}

// Runtime guard for values read from the JSONB column. Prisma returns whatever JSON is
// stored — a manual DB edit or a pre-validator row could violate the type. Delegates to
// the shared `isValidSchedule` predicate so the read-side bounds stay locked to the
// write-side DTO bounds.
function parseSchedule(value: unknown): UserWorkoutSchedule | null {
  if (value === null || value === undefined) return null;
  return isValidSchedule(value) ? value : null;
}

export class UserSettingsRepository implements IUserSettingsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  // Note: upsertSettings is last-write-wins across concurrent PATCH calls for the same
  // user. Acceptable for a single-tab settings flow; revisit if a multi-writer scenario
  // is introduced (e.g., background recalculation that mutates schedule).
  async getSettings(): Promise<UserSettingsResponse> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId: this.userId },
    });
    return {
      activeProgram: row?.activeProgram ?? null,
      workoutSchedule: parseSchedule(row?.workoutSchedule),
    };
  }

  async upsertSettings(patch: UpsertSettingsPatch): Promise<UserSettingsResponse> {
    const update: Prisma.UserSettingsUncheckedUpdateInput = {};
    if (patch.activeProgram !== undefined) update.activeProgram = patch.activeProgram;
    if (patch.workoutSchedule !== undefined) {
      update.workoutSchedule =
        patch.workoutSchedule === null
          ? Prisma.JsonNull
          : // validated by WorkoutScheduleDto before reaching the repository
            (patch.workoutSchedule as unknown as Prisma.InputJsonValue);
    }

    const create: Prisma.UserSettingsUncheckedCreateInput = { userId: this.userId };
    if (patch.activeProgram !== undefined) create.activeProgram = patch.activeProgram;
    if (patch.workoutSchedule != null) {
      create.workoutSchedule = patch.workoutSchedule as unknown as Prisma.InputJsonValue;
    }

    const row = await this.prisma.userSettings.upsert({
      where: { userId: this.userId },
      create,
      update,
    });
    return {
      activeProgram: row.activeProgram ?? null,
      workoutSchedule: parseSchedule(row.workoutSchedule),
    };
  }
}
