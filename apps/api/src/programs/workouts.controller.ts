import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
} from '@nestjs/common';
import { WorkoutResponse } from '@lifting-logbook/types';
import { ICycleDashboardRepository } from '../ports/ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { IWorkoutRepository } from '../ports/IWorkoutRepository';
import {
  CYCLE_DASHBOARD_REPOSITORY,
  LIFTING_PROGRAM_SPEC_REPOSITORY,
  WORKOUT_REPOSITORY,
} from '../ports/tokens';
import { isValidWorkoutNum, toWorkoutResponse } from './mappers';

@Controller('programs/:program')
export class WorkoutsController {
  constructor(
    @Inject(WORKOUT_REPOSITORY)
    private readonly workoutRepo: IWorkoutRepository,
    @Inject(CYCLE_DASHBOARD_REPOSITORY)
    private readonly cycleDashboardRepo: ICycleDashboardRepository,
    @Inject(LIFTING_PROGRAM_SPEC_REPOSITORY)
    private readonly programSpecRepo: ILiftingProgramSpecRepository,
  ) {}

  @Get('workouts/:workoutNum')
  async getWorkout(
    @Param('program') program: string,
    @Param('workoutNum') workoutNumParam: string,
  ): Promise<WorkoutResponse> {
    const workoutNum = Number.parseInt(workoutNumParam, 10);
    if (!isValidWorkoutNum(workoutNum)) {
      throw new BadRequestException(
        'workoutNum must be a positive integer',
      );
    }
    const [dashboard, spec] = await Promise.all([
      this.cycleDashboardRepo.getCycleDashboard(program),
      this.programSpecRepo.getProgramSpec(program),
    ]);

    // Group spec entries by offset (ascending) to map workoutNum → week.
    // workoutNum 1 = first offset group, workoutNum 2 = second, etc.
    const offsetsSorted = [...new Set(spec.map((s) => s.offset))].sort(
      (a, b) => a - b,
    );
    const offsetForWorkout = offsetsSorted[workoutNum - 1];
    const week =
      offsetForWorkout !== undefined
        ? (spec.find((s) => s.offset === offsetForWorkout)?.week ?? 1)
        : 1;

    const records = await this.workoutRepo.getWorkout(
      program,
      dashboard.cycleNum,
      workoutNum,
    );
    return toWorkoutResponse(program, dashboard.cycleNum, workoutNum, week, records);
  }
}
