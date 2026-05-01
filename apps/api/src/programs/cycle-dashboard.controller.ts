import { Controller, Get, Inject, Param } from '@nestjs/common';
import { CycleDashboardResponse } from '@lifting-logbook/types';
import { weekTypeForDate } from '@lifting-logbook/core';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { CYCLE_DASHBOARD_REPOSITORY, LIFTING_PROGRAM_SPEC_REPOSITORY } from '../ports/tokens';
import { toCycleDashboardResponse } from './mappers';

@Controller('programs/:program')
export class CycleDashboardController {
  constructor(
    @Inject(CYCLE_DASHBOARD_REPOSITORY)
    private readonly cycleDashboardRepo: ICycleDashboardRepository,
    @Inject(LIFTING_PROGRAM_SPEC_REPOSITORY)
    private readonly programSpecRepo: ILiftingProgramSpecRepository,
  ) {}

  @Get('cycles/current')
  async getCurrentCycle(
    @Param('program') program: string,
  ): Promise<CycleDashboardResponse> {
    const [dashboard, programSpec] = await Promise.all([
      this.cycleDashboardRepo.getCycleDashboard(program),
      this.programSpecRepo.getProgramSpec(program),
    ]);
    dashboard.currentWeekType = weekTypeForDate(dashboard.cycleDate, programSpec);
    return toCycleDashboardResponse(dashboard);
  }
}
