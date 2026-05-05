import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Put,
} from '@nestjs/common';
import { StrengthGoalResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { toStrengthGoalResponse } from './mappers';
import { UpsertStrengthGoalDto } from './upsert-strength-goal.dto';

@Controller('programs/:program')
export class StrengthGoalsController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('strength-goals')
  async getGoals(
    @Param('program') program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StrengthGoalResponse[]> {
    const { strengthGoal } = await this.factory.forUser(user);
    const goals = await strengthGoal.getGoals(program);
    return goals.map(toStrengthGoalResponse);
  }

  @Put('strength-goals/:lift')
  async upsertGoal(
    @Param('program') program: string,
    @Param('lift') lift: string,
    @Body() body: UpsertStrengthGoalDto,
    @CurrentUser() user: AuthUser,
  ): Promise<StrengthGoalResponse> {
    const { strengthGoal } = await this.factory.forUser(user);
    const saved = await strengthGoal.upsertGoal(program, {
      lift,
      goalType: body.goalType,
      target: body.target,
      unit: body.unit,
      ratio: body.ratio,
      updatedAt: new Date(),
    });
    return toStrengthGoalResponse(saved);
  }

  @Delete('strength-goals/:lift')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGoal(
    @Param('program') program: string,
    @Param('lift') lift: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const { strengthGoal } = await this.factory.forUser(user);
    await strengthGoal.deleteGoal(program, lift);
  }
}
