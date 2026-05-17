import { Controller, Get, Inject, Param } from '@nestjs/common';
import { CycleDashboardResponse } from '@lifting-logbook/types';
import { weekTypeForDate } from '@lifting-logbook/core';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { buildCycleDashboardResponse } from './mappers';

@Controller('programs/:program')
export class CycleDashboardController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('cycles/current')
  async getCurrentCycle(
    @Param('program') program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CycleDashboardResponse> {
    const { cycleDashboard, cycleScheduledWorkout, liftingProgramSpec, liftRecord, workoutDateOverride } =
      await this.factory.forUser(user);

    const [dashboard, programSpec] = await Promise.all([
      cycleDashboard.getCycleDashboard(program),
      liftingProgramSpec.getProgramSpec(program),
    ]);
    dashboard.currentWeekType = weekTypeForDate(dashboard.cycleDate, programSpec);

    const [scheduledWorkouts, liftRecords] = await Promise.all([
      cycleScheduledWorkout.getScheduledWorkouts(program, dashboard.cycleNum),
      liftRecord.getLiftRecords(program, dashboard.cycleNum),
    ]);

    const overrideDates = await Promise.all(
      scheduledWorkouts.map((sw) =>
        workoutDateOverride.getOverride(program, dashboard.cycleNum, sw.workoutNum),
      ),
    );
    const overrideMap = new Map<number, Date | null>(
      scheduledWorkouts.map((sw, i) => [sw.workoutNum, overrideDates[i]!]),
    );
    const completedWorkoutNums = new Set(liftRecords.map((r) => r.workoutNum));

    return buildCycleDashboardResponse(dashboard, scheduledWorkouts, overrideMap, completedWorkoutNums);
  }
}
