import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { BodyWeightEntry, RecordBodyWeightRequest } from '@lifting-logbook/types';
import { IBodyWeightRepository } from '../ports/IBodyWeightRepository';
import { BODY_WEIGHT_REPOSITORY } from '../ports/tokens';

@Controller('programs/:program')
export class BodyWeightController {
  constructor(
    @Inject(BODY_WEIGHT_REPOSITORY)
    private readonly bodyWeightRepo: IBodyWeightRepository,
  ) {}

  @Post('body-weight')
  @HttpCode(HttpStatus.CREATED)
  async recordBodyWeight(
    @Param('program') program: string,
    @Body() body: RecordBodyWeightRequest,
  ): Promise<void> {
    const entry: BodyWeightEntry = {
      date: new Date(body.date),
      weight: body.weight,
      unit: body.unit,
    };
    await this.bodyWeightRepo.recordBodyWeight(program, entry);
  }
}
