import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param } from '@nestjs/common';
import { CycleDashboardResponse } from '@lifting-logbook/types';
import { weekTypeForDate } from '@lifting-logbook/core';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { buildCycleDashboardResponse } from './mappers';
import { CycleGenerationService } from './cycle-generation.service';

@Controller('programs/:program')
export class CycleDashboardController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
    private readonly cycleGenerationService: CycleGenerationService,
  ) {}

  @Get('cycles/current')
  async getCurrentCycle(
    @Param('program') program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CycleDashboardResponse> {
    const { cycleDashboard, cycleScheduledWorkout, liftingProgramSpec, liftRecord, workoutDateOverride, workoutSkipOverride } =
      await this.factory.forUser(user);

    const [dashboard, programSpec] = await Promise.all([
      cycleDashboard.getCycleDashboard(program),
      liftingProgramSpec.getProgramSpec(program),
    ]);
    const currentWeekType = weekTypeForDate(dashboard.cycleDate, programSpec);

    const [scheduledWorkouts, liftRecords, overrideMap, skippedNums] = await Promise.all([
      cycleScheduledWorkout.getScheduledWorkouts(program, dashboard.cycleNum),
      liftRecord.getLiftRecords(program, dashboard.cycleNum),
      workoutDateOverride.getOverridesForCycle(program, dashboard.cycleNum),
      workoutSkipOverride.getSkipsForCycle(program, dashboard.cycleNum),
    ]);
    const completedWorkoutNums = new Set(liftRecords.map((r) => r.workoutNum));

    return buildCycleDashboardResponse(dashboard, currentWeekType, scheduledWorkouts, overrideMap, completedWorkoutNums, skippedNums);
  }

  @Delete('cycles/current')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCurrentCycle(
    @Param('program') program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const repos = await this.factory.forUser(user);
    await this.cycleGenerationService.deleteCurrentCycle(repos, program);
  }
}
