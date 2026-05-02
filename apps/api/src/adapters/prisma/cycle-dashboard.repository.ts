import { PrismaClient } from '@prisma/client';
import { CycleDashboard, Weekday } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../../ports/ICycleDashboardRepository';
import { ProgramNotFoundError } from '../../ports/errors';

export class PrismaCycleDashboardRepository implements ICycleDashboardRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getCycleDashboard(program: string): Promise<CycleDashboard> {
    const row = await this.prisma.cycleDashboard.findUnique({
      where: { userId_program: { userId: this.userId, program } },
    });
    if (!row) throw new ProgramNotFoundError(program);
    return {
      program: row.program,
      cycleUnit: row.cycleUnit,
      cycleNum: row.cycleNum,
      cycleDate: row.cycleDate,
      sheetName: row.sheetName,
      cycleStartWeekday: row.cycleStartWeekday as Weekday,
      currentWeekType: row.currentWeekType as CycleDashboard['currentWeekType'],
      ...(row.programType !== null && { programType: row.programType }),
    };
  }

  async saveCycleDashboard(dashboard: CycleDashboard): Promise<void> {
    await this.prisma.cycleDashboard.upsert({
      where: { userId_program: { userId: this.userId, program: dashboard.program } },
      create: {
        userId: this.userId,
        program: dashboard.program,
        cycleUnit: dashboard.cycleUnit,
        cycleNum: dashboard.cycleNum,
        cycleDate: dashboard.cycleDate,
        sheetName: dashboard.sheetName,
        cycleStartWeekday: dashboard.cycleStartWeekday,
        currentWeekType: dashboard.currentWeekType,
        programType: dashboard.programType ?? null,
      },
      update: {
        cycleUnit: dashboard.cycleUnit,
        cycleNum: dashboard.cycleNum,
        cycleDate: dashboard.cycleDate,
        sheetName: dashboard.sheetName,
        cycleStartWeekday: dashboard.cycleStartWeekday,
        currentWeekType: dashboard.currentWeekType,
        programType: dashboard.programType ?? null,
      },
    });
  }
}
