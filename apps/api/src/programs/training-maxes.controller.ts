import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import {
  TrainingMaxResponse,
  UpdateTrainingMaxesRequest,
} from '@lifting-logbook/types';
import type { TrainingMax } from '@lifting-logbook/core';
import { ITrainingMaxRepository } from '../ports/ITrainingMaxRepository';
import { TRAINING_MAX_REPOSITORY } from '../ports/tokens';
import { toTrainingMaxResponse } from './mappers';

@Controller('programs/:program')
export class TrainingMaxesController {
  constructor(
    @Inject(TRAINING_MAX_REPOSITORY)
    private readonly trainingMaxRepo: ITrainingMaxRepository,
  ) {}

  @Get('training-maxes')
  async getTrainingMaxes(
    @Param('program') program: string,
  ): Promise<TrainingMaxResponse[]> {
    const maxes = await this.trainingMaxRepo.getTrainingMaxes(program);
    return maxes.map(toTrainingMaxResponse);
  }

  @Patch('training-maxes')
  async updateTrainingMaxes(
    @Param('program') program: string,
    @Body() body: UpdateTrainingMaxesRequest,
  ): Promise<TrainingMaxResponse[]> {
    const existing = await this.trainingMaxRepo.getTrainingMaxes(program);
    const incomingMap = new Map(
      body.maxes.map((m) => [m.lift, m.weight]),
    );
    const today = new Date();
    const merged: TrainingMax[] = existing.map((m) =>
      incomingMap.has(m.lift)
        ? { lift: m.lift, weight: incomingMap.get(m.lift)!, dateUpdated: today }
        : m,
    );
    // Add lifts not previously recorded
    for (const incoming of body.maxes) {
      if (!merged.some((m) => m.lift === incoming.lift)) {
        merged.push({ lift: incoming.lift, weight: incoming.weight, dateUpdated: today });
      }
    }
    await this.trainingMaxRepo.saveTrainingMaxes(program, merged);
    return merged.map(toTrainingMaxResponse);
  }
}
