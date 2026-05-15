import { PrismaService } from '../adapters/prisma/prisma.service';
import { UserSettingsResponse } from '@lifting-logbook/types';

export class UserSettingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userId: string,
  ) {}

  async getSettings(): Promise<UserSettingsResponse> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId: this.userId },
    });
    return { activeProgram: row?.activeProgram ?? null };
  }

  async upsertSettings(patch: { activeProgram?: string }): Promise<UserSettingsResponse> {
    const row = await this.prisma.userSettings.upsert({
      where: { userId: this.userId },
      create: { userId: this.userId, ...patch },
      update: patch,
    });
    return { activeProgram: row.activeProgram ?? null };
  }
}
