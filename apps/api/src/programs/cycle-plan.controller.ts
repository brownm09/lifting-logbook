import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { CyclePlanResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { ICyclePlanningAgent } from '../ports/ICyclePlanningAgent';
import { CYCLE_PLANNING_AGENT, REPOSITORY_FACTORY } from '../ports/tokens';
import { CyclePlanRequestDto } from './cycle-plan.dto';
import { toCyclePlanResponse } from './mappers';

@Controller('cycle-plan')
export class CyclePlanController {
  constructor(
    @Inject(CYCLE_PLANNING_AGENT)
    private readonly agent: ICyclePlanningAgent,
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async plan(
    @Body() dto: CyclePlanRequestDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CyclePlanResponse> {
    const repos = await this.factory.forUser(user);
    const result = await this.agent.plan(repos, {
      program: dto.program,
      goal: dto.goal,
      cycleNum: dto.cycleNum,
    });
    return toCyclePlanResponse(result);
  }
}
