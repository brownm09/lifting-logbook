import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
} from '@nestjs/common';
import { WorkoutResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { isValidWorkoutNum, toWorkoutResponse, weekForWorkoutNum } from './mappers';

@Controller('programs/:program')
export class WorkoutsController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('workouts/:workoutNum')
  async getWorkout(
    @Param('program') program: string,
    @Param('workoutNum') workoutNumParam: string,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkoutResponse> {
    const workoutNum = Number.parseInt(workoutNumParam, 10);
    if (!isValidWorkoutNum(workoutNum)) {
      throw new BadRequestException('workoutNum must be a positive integer');
    }
    const { workout, cycleDashboard, liftingProgramSpec, workoutDateOverride } = await this.factory.forUser(user);
    const [dashboard, spec] = await Promise.all([
      cycleDashboard.getCycleDashboard(program),
      liftingProgramSpec.getProgramSpec(program),
    ]);
    const week = weekForWorkoutNum(spec, workoutNum);
    if (week === undefined) {
      throw new BadRequestException(
        `workoutNum ${workoutNum} exceeds program spec (${new Set(spec.map((s) => s.offset)).size} workout days)`,
      );
    }
    const [records, overrideDate] = await Promise.all([
      workout.getWorkout(program, dashboard.cycleNum, workoutNum),
      workoutDateOverride.getOverride(program, dashboard.cycleNum, workoutNum),
    ]);
    return toWorkoutResponse(program, dashboard.cycleNum, workoutNum, week, records, overrideDate ?? undefined);
  }
}
