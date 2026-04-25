import { Controller, Get, Inject, Param } from '@nestjs/common';
import { LiftingProgramSpecResponse } from '@lifting-logbook/types';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { LIFTING_PROGRAM_SPEC_REPOSITORY } from '../ports/tokens';
import { toLiftingProgramSpecResponse } from './mappers';

@Controller('programs/:program')
export class ProgramSpecController {
  constructor(
    @Inject(LIFTING_PROGRAM_SPEC_REPOSITORY)
    private readonly programSpecRepo: ILiftingProgramSpecRepository,
  ) {}

  @Get('spec')
  async getProgramSpec(
    @Param('program') program: string,
  ): Promise<LiftingProgramSpecResponse[]> {
    const spec = await this.programSpecRepo.getProgramSpec(program);
    return spec.map(toLiftingProgramSpecResponse);
  }
}
