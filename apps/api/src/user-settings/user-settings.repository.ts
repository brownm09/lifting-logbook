import { Prisma } from '@prisma/client';
import { PrismaService } from '../adapters/prisma/prisma.service';
import { UserSettingsResponse, UserWorkoutSchedule } from '@lifting-logbook/types';

export interface UpsertSettingsPatch {
  activeProgram?: string;
  // Explicit `null` clears the schedule; `undefined` leaves it unchanged.
  workoutSchedule?: UserWorkoutSchedule | null;
}

export class UserSettingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userId: string,
  ) {}

  async getSettings(): Promise<UserSettingsResponse> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId: this.userId },
    });
    return {
      activeProgram: row?.activeProgram ?? null,
      workoutSchedule: (row?.workoutSchedule as unknown as UserWorkoutSchedule | null) ?? null,
    };
  }

  async upsertSettings(patch: UpsertSettingsPatch): Promise<UserSettingsResponse> {
    const update: Prisma.UserSettingsUncheckedUpdateInput = {};
    if (patch.activeProgram !== undefined) update.activeProgram = patch.activeProgram;
    if (patch.workoutSchedule !== undefined) {
      update.workoutSchedule =
        patch.workoutSchedule === null
          ? Prisma.JsonNull
          : (patch.workoutSchedule as unknown as Prisma.InputJsonValue);
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
      workoutSchedule: (row.workoutSchedule as unknown as UserWorkoutSchedule | null) ?? null,
    };
  }
}
