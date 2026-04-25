import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  CycleDashboardResponse,
  TrainingMaxResponse,
} from '@lifting-logbook/types';
import { toCycleDashboardResponse, toTrainingMaxResponse } from './mappers';
import { CycleGenerationService } from './cycle-generation.service';

@Controller('programs/:program')
export class CycleGenerationController {
  constructor(
    private readonly cycleGenerationService: CycleGenerationService,
  ) {}

  /**
   * POST /programs/:program/cycles
   *
   * Starts a new cycle: advances the cycle counter, updates training maxes
   * from the current cycle's lift records, and persists both. Returns the
   * new cycle dashboard.
   */
  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  async startNewCycle(
    @Param('program') program: string,
  ): Promise<CycleDashboardResponse> {
    const newCycle = await this.cycleGenerationService.startNewCycle(program);
    return toCycleDashboardResponse(newCycle);
  }

  /**
   * POST /programs/:program/training-maxes/recalculate
   *
   * Re-runs training max calculation against the current cycle's lift records
   * without advancing the cycle. Returns the updated training maxes.
   */
  @Post('training-maxes/recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculateMaxes(
    @Param('program') program: string,
  ): Promise<TrainingMaxResponse[]> {
    const maxes = await this.cycleGenerationService.recalculateMaxes(program);
    return maxes.map(toTrainingMaxResponse);
  }
}
