import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { programLengthWeeks } from '@lifting-logbook/core';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { isValidWorkoutNum, workoutKeyForWorkoutNum } from './mappers';

class SkipWorkoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@Controller('programs/:program')
export class WorkoutSkipController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Post('cycles/:cycleNum/workouts/:workoutNum/skip')
  @HttpCode(HttpStatus.NO_CONTENT)
  async skipWorkout(
    @Param('program') program: string,
    @Param('cycleNum') cycleNumParam: string,
    @Param('workoutNum') workoutNumParam: string,
    @Body() dto: SkipWorkoutDto,
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

    const { workoutSkipOverride, liftingProgramSpec, cycleDashboard } =
      await this.factory.forUser(user);
    await this.assertActiveInBoundsTarget(
      program,
      cycleNum,
      workoutNum,
      liftingProgramSpec,
      cycleDashboard,
    );
    await workoutSkipOverride.skipWorkout(program, cycleNum, workoutNum, dto.reason);
  }

  @Delete('cycles/:cycleNum/workouts/:workoutNum/skip')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unskipWorkout(
    @Param('program') program: string,
    @Param('cycleNum') cycleNumParam: string,
    @Param('workoutNum') workoutNumParam: string,
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

    const { workoutSkipOverride, liftingProgramSpec, cycleDashboard } =
      await this.factory.forUser(user);
    await this.assertActiveInBoundsTarget(
      program,
      cycleNum,
      workoutNum,
      liftingProgramSpec,
      cycleDashboard,
    );
    await workoutSkipOverride.unskipWorkout(program, cycleNum, workoutNum);
  }

  /**
   * Rejects a skip/unskip target the current-cycle read model could never
   * surface, so the endpoint can't silently record dead data (a 204 with no
   * visible effect — the failure mode #773 flagged). Shared by both skip (POST)
   * and unskip (DELETE); mirrors the RescheduleController bounds/cycle checks
   * (#773/#775). Order matters — spec (404) → workoutNum bound (400) → active
   * cycle (400) — so the cheapest, most-specific failure wins and the dashboard
   * is only loaded once the workoutNum is known to be in range.
   */
  private async assertActiveInBoundsTarget(
    program: string,
    cycleNum: number,
    workoutNum: number,
    liftingProgramSpec: ILiftingProgramSpecRepository,
    cycleDashboard: ICycleDashboardRepository,
  ): Promise<void> {
    const spec = await liftingProgramSpec.getProgramSpec(program);
    if (spec.length === 0) {
      throw new NotFoundException(`Program '${program}' not found`);
    }

    // Reject a workoutNum past the program's spec-derived canonical length, via
    // the same workoutKeyForWorkoutNum helper the GET workout endpoint uses.
    // Without this a skip is recorded for a workoutNum that maps to no real
    // workout day and is silently never surfaced.
    if (workoutKeyForWorkoutNum(spec, workoutNum, program) === undefined) {
      throw new BadRequestException(
        `workoutNum ${workoutNum} exceeds the program's ${programLengthWeeks(program, spec)}-week schedule`,
      );
    }

    // getCycleDashboard throws ProgramNotFoundError when the program has no
    // cycle. Its cycleNum is the *active* cycle, and the entire read model (GET
    // workout, cycle dashboard, getSkipsForCycle) reads only that cycle — a skip
    // written for any other cycleNum is dead data the client can never see.
    const dashboard = await cycleDashboard.getCycleDashboard(program);
    if (cycleNum !== dashboard.cycleNum) {
      throw new BadRequestException(
        `cycleNum ${cycleNum} is not the active cycle (${dashboard.cycleNum})`,
      );
    }
  }
}
