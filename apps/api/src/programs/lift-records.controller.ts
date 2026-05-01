import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateLiftRecordRequest,
  LiftRecordResponse,
  UpdateLiftRecordRequest,
} from '@lifting-logbook/types';
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

  @Post('lift-records')
  @HttpCode(HttpStatus.CREATED)
  async createLiftRecord(
    @Param('program') program: string,
    @Body() body: CreateLiftRecordRequest,
  ): Promise<LiftRecordResponse> {
    const record = {
      program,
      cycleNum: body.cycleNum,
      workoutNum: body.workoutNum,
      date: new Date(body.date),
      lift: body.lift,
      setNum: body.setNum,
      weight: body.weight,
      reps: body.reps,
      notes: body.notes ?? '',
    };
    await this.liftRecordRepo.appendLiftRecords(program, [record]);
    return toLiftRecordResponse(record);
  }

  @Patch('lift-records/:id')
  async updateLiftRecord(
    @Param('program') program: string,
    @Param('id') id: string,
    @Body() body: UpdateLiftRecordRequest,
  ): Promise<LiftRecordResponse> {
    const updated = await this.liftRecordRepo.updateLiftRecord(program, id, body);
    if (!updated) {
      throw new NotFoundException(
        `Lift record '${id}' not found for program '${program}'`,
      );
    }
    return toLiftRecordResponse(updated);
  }
}
