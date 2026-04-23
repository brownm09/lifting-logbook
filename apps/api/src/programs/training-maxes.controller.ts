import { Controller, Get, Inject, Param } from '@nestjs/common';
import { TrainingMaxResponse } from '@lifting-logbook/types';
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
}
