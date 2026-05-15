import { Controller, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { SwitchProgramResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { PrismaService } from '../adapters/prisma/prisma.service';
import { UserSettingsRepository } from '../user-settings/user-settings.repository';
import { CycleGenerationService } from './cycle-generation.service';
import { ParseProgramPipe } from './program.pipe';
import { ProgramNotFoundError } from '../ports/errors';

@Controller('programs/:program')
export class SwitchProgramController {
  constructor(
    private readonly cycleGenerationService: CycleGenerationService,
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post('switch')
  @HttpCode(HttpStatus.OK)
  async switchProgram(
    @Param('program', ParseProgramPipe) program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SwitchProgramResponse> {
    const settingsRepo = new UserSettingsRepository(this.prisma, user.id);
    const repos = await this.factory.forUser(user);

    // Ensure a CycleDashboard exists for this program; create if not.
    // Order is intentional: cycle init runs first so that if the settings write
    // fails the dashboard exists but is not yet referenced — a retry will skip
    // init and succeed at the settings write. The inverse (settings written,
    // init failed) would leave the user's active program pointing at a cycle
    // that doesn't exist yet, which is a harder state to recover from.
    let cycleNum = 1;
    try {
      const existing = await repos.cycleDashboard.getCycleDashboard(program);
      cycleNum = existing.cycleNum;
    } catch (e) {
      if (e instanceof ProgramNotFoundError) {
        const dashboard = await this.cycleGenerationService.initializeFirstCycle(repos, program);
        cycleNum = dashboard.cycleNum;
      } else {
        throw e;
      }
    }

    await settingsRepo.upsertSettings({ activeProgram: program });

    return { activeProgram: program, cycleNum };
  }
}
