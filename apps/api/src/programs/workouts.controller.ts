import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
} from '@nestjs/common';
import { WorkoutResponse } from '@lifting-logbook/types';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { IWorkoutRepository } from '../ports/IWorkoutRepository';
import {
  CYCLE_DASHBOARD_REPOSITORY,
  WORKOUT_REPOSITORY,
} from '../ports/tokens';
import {
  MAX_WORKOUT_NUM,
  isValidWorkoutNum,
  toWorkoutResponse,
} from './mappers';

@Controller('programs/:program')
export class WorkoutsController {
  constructor(
    @Inject(WORKOUT_REPOSITORY)
    private readonly workoutRepo: IWorkoutRepository,
    @Inject(CYCLE_DASHBOARD_REPOSITORY)
    private readonly cycleDashboardRepo: ICycleDashboardRepository,
  ) {}

  @Get('workouts/:workoutNum')
  async getWorkout(
    @Param('program') program: string,
    @Param('workoutNum') workoutNumParam: string,
  ): Promise<WorkoutResponse> {
    const workoutNum = Number.parseInt(workoutNumParam, 10);
    if (!isValidWorkoutNum(workoutNum)) {
      throw new BadRequestException(
        `workoutNum must be an integer in [1, ${MAX_WORKOUT_NUM}]`,
      );
    }
    const dashboard = await this.cycleDashboardRepo.getCycleDashboard(program);
    const records = await this.workoutRepo.getWorkout(
      program,
      dashboard.cycleNum,
      workoutNum,
    );
    return toWorkoutResponse(program, dashboard.cycleNum, workoutNum, records);
  }
}
