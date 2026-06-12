import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { CyclePlanResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory, RepositoryBundle } from '../ports/factory';
import { ICyclePlanningAgent } from '../ports/ICyclePlanningAgent';
import { CYCLE_PLANNING_AGENT, REPOSITORY_FACTORY } from '../ports/tokens';
import { SkipRlsTransaction } from '../adapters/prisma/rls-context';
import { RlsContextService } from '../adapters/prisma/rls-context.service';
import { CyclePlanRequestDto } from './cycle-plan.dto';
import { toCyclePlanResponse } from './mappers';

@Controller('cycle-plan')
export class CyclePlanController {
  constructor(
    @Inject(CYCLE_PLANNING_AGENT)
    private readonly agent: ICyclePlanningAgent,
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
    private readonly rlsContext: RlsContextService,
  ) {}

  // This handler calls an LLM between/around its DB reads. @SkipRlsTransaction() opts it out of the
  // per-request RLS transaction so a DB connection is NOT pinned for the whole (slow) model call.
  // Instead, each tool dispatch in the agent loop runs inside its own short-lived RLS transaction
  // via `withContext`, which builds the repositories inside that transaction so they bind to the
  // RLS-scoped client. The LLM round-trips happen outside any transaction. See issue #518.
  @Post()
  @HttpCode(HttpStatus.OK)
  @SkipRlsTransaction()
  async plan(
    @Body() dto: CyclePlanRequestDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CyclePlanResponse> {
    const withContext = <T>(fn: (repos: RepositoryBundle) => Promise<T>): Promise<T> =>
      this.rlsContext.withUserContext(() => this.factory.forUser(user).then(fn));
    const result = await this.agent.plan(
      {
        program: dto.program,
        goal: dto.goal,
        cycleNum: dto.cycleNum,
      },
      withContext,
    );
    return toCyclePlanResponse(result);
  }
}
