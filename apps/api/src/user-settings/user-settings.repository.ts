import { Prisma } from '@prisma/client';
import { PrismaService } from '../adapters/prisma/prisma.service';
import { UserSettingsResponse, UserWorkoutSchedule } from '@lifting-logbook/types';

export interface UpsertSettingsPatch {
  activeProgram?: string;
  // Explicit `null` clears the schedule; `undefined` leaves it unchanged.
  workoutSchedule?: UserWorkoutSchedule | null;
}

// Runtime guard for values read from the JSONB column. Prisma returns whatever JSON is
// stored — a manual DB edit or a pre-validator row could violate the type. Return null
// (treated as no-schedule) rather than letting malformed data reach clients.
function parseSchedule(value: unknown): UserWorkoutSchedule | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as { type?: unknown; days?: unknown; weeks?: unknown };
  if (v.type === 'fixed') {
    if (!Array.isArray(v.days) || v.days.length === 0) return null;
    for (const d of v.days) {
      if (!Number.isInteger(d) || (d as number) < 0 || (d as number) > 6) return null;
    }
    return { type: 'fixed', days: v.days as number[] };
  }
  if (v.type === 'rotating') {
    if (!Array.isArray(v.weeks) || v.weeks.length === 0) return null;
    for (const week of v.weeks) {
      if (!Array.isArray(week) || week.length === 0) return null;
      for (const d of week) {
        if (!Number.isInteger(d) || (d as number) < 0 || (d as number) > 6) return null;
      }
    }
    return { type: 'rotating', weeks: v.weeks as number[][] };
  }
  return null;
}

export class UserSettingsRepository {
  constructor(
    private readonly prisma: PrismaService,
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
