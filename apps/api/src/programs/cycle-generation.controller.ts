import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import {
  CycleDashboardResponse,
  RecalculateMaxesResponse,
} from '@lifting-logbook/types';
import { weekTypeForDate } from '@lifting-logbook/core';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { toCycleDashboardResponse, toTrainingMaxResponse } from './mappers';
import { ParseProgramPipe } from './program.pipe';
import { InitializeCycleDto } from './initialize-cycle.dto';
import { StartNewCycleDto } from './start-new-cycle.dto';
import { CycleGenerationService } from './cycle-generation.service';

@Controller('programs/:program')
export class CycleGenerationController {
  constructor(
    private readonly cycleGenerationService: CycleGenerationService,
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  // NOTE: 'cycles/initialize' must be declared before 'cycles' so NestJS matches
  // the literal path segment "initialize" before the advance-cycle handler.
  @Post('cycles/initialize')
  async initializeFirstCycle(
    @Param('program', ParseProgramPipe) program: string,
    @Body() dto: InitializeCycleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CycleDashboardResponse> {
    const repos = await this.factory.forUser(user);
    const { dashboard, programSpec } = await this.cycleGenerationService.initializeFirstCycle(repos, program, dto);
    const currentWeekType = weekTypeForDate(dashboard.cycleDate, programSpec);
    return toCycleDashboardResponse(dashboard, currentWeekType);
  }

  @Post('cycles')
  async startNewCycle(
    @Param('program', ParseProgramPipe) program: string,
    @Body() dto: StartNewCycleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CycleDashboardResponse> {
    const repos = await this.factory.forUser(user);
    const { dashboard: newCycle, programSpec } = await this.cycleGenerationService.startNewCycle(repos, program, dto);
    const currentWeekType = weekTypeForDate(newCycle.cycleDate, programSpec);
    return toCycleDashboardResponse(newCycle, currentWeekType);
  }

  @Post('training-maxes/recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculateMaxes(
    @Param('program', ParseProgramPipe) program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<RecalculateMaxesResponse> {
    const repos = await this.factory.forUser(user);
    const { maxes, flagged } = await this.cycleGenerationService.recalculateMaxes(repos, program);
    return { maxes: maxes.map(toTrainingMaxResponse), flagged };
  }
}
