import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { CyclePlanResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { ICyclePlanningAgent } from '../ports/ICyclePlanningAgent';
import { CYCLE_PLANNING_AGENT, REPOSITORY_FACTORY } from '../ports/tokens';
import { RlsTxTimeout } from '../adapters/prisma/rls-context';
import { CyclePlanRequestDto } from './cycle-plan.dto';
import { toCyclePlanResponse } from './mappers';

@Controller('cycle-plan')
export class CyclePlanController {
  constructor(
    @Inject(CYCLE_PLANNING_AGENT)
    private readonly agent: ICyclePlanningAgent,
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  // This handler calls an LLM between/around its DB reads, so the per-request RLS transaction
  // (which sets app.current_user_id and must stay open for the request's queries) is held for the
  // duration of the model call. Raise the RLS transaction timeout well above the default to cover
  // that latency. Trade-off: a DB connection is pinned for the call; cycle planning is low-volume,
  // so this is acceptable. Moving the LLM call outside the transaction is tracked as a follow-up.
  @Post()
  @HttpCode(HttpStatus.OK)
  @RlsTxTimeout(120_000)
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
