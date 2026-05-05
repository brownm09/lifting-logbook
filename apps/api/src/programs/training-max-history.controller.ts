import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  TrainingMaxHistoryEntryResponse,
  TrainingMaxHistoryResponse,
  UpdateTrainingMaxHistoryRequest,
} from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { toTrainingMaxHistoryEntryResponse } from './mappers';

@Controller('programs/:program')
export class TrainingMaxHistoryController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('training-maxes/history')
  async getHistory(
    @Param('program') program: string,
    @Query('lift') lift?: string,
    @Query('source') source?: 'test' | 'program',
    @Query('isPR') isPRStr?: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<TrainingMaxHistoryResponse> {
    const { trainingMaxHistory } = await this.factory.forUser(user!);
    const isPR =
      isPRStr === 'true' ? true : isPRStr === 'false' ? false : undefined;
    const filters = {
      ...(lift !== undefined && { lift }),
      ...(source !== undefined && { source }),
      ...(isPR !== undefined && { isPR }),
    };
    const entries = await trainingMaxHistory.getHistory(program, filters);
    return { entries: entries.map(toTrainingMaxHistoryEntryResponse) };
  }

  @Patch('training-maxes/history/:id')
  async updateEntry(
    @Param('program') program: string,
    @Param('id') id: string,
    @Body() body: UpdateTrainingMaxHistoryRequest,
    @CurrentUser() user?: AuthUser,
  ): Promise<TrainingMaxHistoryEntryResponse> {
    const { trainingMaxHistory } = await this.factory.forUser(user!);
    const updated = await trainingMaxHistory.updateHistoryEntry(program, id, body);
    return toTrainingMaxHistoryEntryResponse(updated);
  }
}
