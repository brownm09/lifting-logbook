import { Controller, Get, Inject, Param } from '@nestjs/common';
import { LiftingProgramSpecResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { toLiftingProgramSpecResponse } from './mappers';

@Controller('programs/:program')
export class ProgramSpecController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('spec')
  async getProgramSpec(
    @Param('program') program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LiftingProgramSpecResponse[]> {
    const { liftingProgramSpec } = await this.factory.forUser(user);
    const spec = await liftingProgramSpec.getProgramSpec(program);
    return spec.map(toLiftingProgramSpecResponse);
  }
}
