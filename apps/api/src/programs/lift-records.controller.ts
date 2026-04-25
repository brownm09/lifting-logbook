import { Controller, Get, Inject, Param } from '@nestjs/common';
import { LiftRecordResponse } from '@lifting-logbook/types';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { ILiftRecordRepository } from '../ports/ILiftRecordRepository';
import {
  CYCLE_DASHBOARD_REPOSITORY,
  LIFT_RECORD_REPOSITORY,
} from '../ports/tokens';
import { toLiftRecordResponse } from './mappers';

@Controller('programs/:program')
export class LiftRecordsController {
  constructor(
    @Inject(LIFT_RECORD_REPOSITORY)
    private readonly liftRecordRepo: ILiftRecordRepository,
    @Inject(CYCLE_DASHBOARD_REPOSITORY)
    private readonly cycleDashboardRepo: ICycleDashboardRepository,
  ) {}

  @Get('lift-records')
  async getLiftRecords(
    @Param('program') program: string,
  ): Promise<LiftRecordResponse[]> {
    const dashboard = await this.cycleDashboardRepo.getCycleDashboard(program);
    const records = await this.liftRecordRepo.getLiftRecords(
      program,
      dashboard.cycleNum,
    );
    return records.map(toLiftRecordResponse);
  }
}
