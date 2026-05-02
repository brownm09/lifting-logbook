import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import {
  CycleDashboardResponse,
  TrainingMaxResponse,
} from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { toCycleDashboardResponse, toTrainingMaxResponse } from './mappers';
import { ParseProgramPipe } from './program.pipe';
import { StartNewCycleDto } from './start-new-cycle.dto';
import { CycleGenerationService } from './cycle-generation.service';

@Controller('programs/:program')
export class CycleGenerationController {
  constructor(
    private readonly cycleGenerationService: CycleGenerationService,
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Post('cycles')
  async startNewCycle(
    @Param('program', ParseProgramPipe) program: string,
    @Body() dto: StartNewCycleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CycleDashboardResponse> {
    const repos = await this.factory.forUser(user);
    const newCycle = await this.cycleGenerationService.startNewCycle(repos, program, dto);
    return toCycleDashboardResponse(newCycle);
  }

  @Post('training-maxes/recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculateMaxes(
    @Param('program', ParseProgramPipe) program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<TrainingMaxResponse[]> {
    const repos = await this.factory.forUser(user);
    const maxes = await this.cycleGenerationService.recalculateMaxes(repos, program);
    return maxes.map(toTrainingMaxResponse);
  }
}
