import { Controller, Get, Inject, Param } from '@nestjs/common';
import { CycleDashboardResponse } from '@lifting-logbook/types';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { CYCLE_DASHBOARD_REPOSITORY } from '../ports/tokens';
import { toCycleDashboardResponse } from './mappers';

@Controller('programs/:program')
export class CycleDashboardController {
  constructor(
    @Inject(CYCLE_DASHBOARD_REPOSITORY)
    private readonly cycleDashboardRepo: ICycleDashboardRepository,
  ) {}

  @Get('cycles/current')
  async getCurrentCycle(
    @Param('program') program: string,
  ): Promise<CycleDashboardResponse> {
    const dashboard = await this.cycleDashboardRepo.getCycleDashboard(program);
    return toCycleDashboardResponse(dashboard);
  }
}
