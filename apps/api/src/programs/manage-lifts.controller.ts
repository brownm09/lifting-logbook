import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { LIFT_NAMES, LiftOverrideResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { toLiftOverrideResponse, isValidWorkoutNum } from './mappers';
import { LiftOverrideDto } from './lift-override.dto';

@Controller('programs/:program')
export class ManageLiftsController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('lifts')
  getLifts(): string[] {
    return [...LIFT_NAMES];
  }

  @Post('cycles/:cycleNum/workouts/:workoutNum/lift-overrides')
  @HttpCode(HttpStatus.CREATED)
  async upsertOverride(
    @Param('program') program: string,
    @Param('cycleNum') cycleNumParam: string,
    @Param('workoutNum') workoutNumParam: string,
    @Body() dto: LiftOverrideDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LiftOverrideResponse> {
    const cycleNum = Number.parseInt(cycleNumParam, 10);
    const workoutNum = Number.parseInt(workoutNumParam, 10);

    if (!Number.isInteger(cycleNum) || cycleNum < 1) {
      throw new BadRequestException('cycleNum must be a positive integer');
    }
    if (!isValidWorkoutNum(workoutNum)) {
      throw new BadRequestException('workoutNum must be a positive integer');
    }
    if (dto.action === 'replace' && !dto.replacedBy) {
      throw new BadRequestException("replacedBy is required when action is 'replace'");
    }

    const { workoutLiftOverride, liftingProgramSpec } = await this.factory.forUser(user);

    const spec = await liftingProgramSpec.getProgramSpec(program);
    if (spec.length === 0) {
      throw new NotFoundException(`Program '${program}' not found`);
    }

    const override = {
      lift: dto.lift,
      action: dto.action,
      ...(dto.replacedBy !== undefined && { replacedBy: dto.replacedBy }),
    };
    await workoutLiftOverride.upsertOverride(program, cycleNum, workoutNum, override);
    return toLiftOverrideResponse(override);
  }

  @Delete('cycles/:cycleNum/workouts/:workoutNum/lift-overrides/:lift')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOverride(
    @Param('program') program: string,
    @Param('cycleNum') cycleNumParam: string,
    @Param('workoutNum') workoutNumParam: string,
    @Param('lift') lift: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const cycleNum = Number.parseInt(cycleNumParam, 10);
    const workoutNum = Number.parseInt(workoutNumParam, 10);

    if (!Number.isInteger(cycleNum) || cycleNum < 1) {
      throw new BadRequestException('cycleNum must be a positive integer');
    }
    if (!isValidWorkoutNum(workoutNum)) {
      throw new BadRequestException('workoutNum must be a positive integer');
    }

    const { workoutLiftOverride } = await this.factory.forUser(user);
    await workoutLiftOverride.deleteOverride(program, cycleNum, workoutNum, decodeURIComponent(lift));
  }
}
