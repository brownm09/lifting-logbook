import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
} from '@nestjs/common';
import { LiftRecord } from '@lifting-logbook/core';
import { WorkoutResponse } from '@lifting-logbook/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { ProgramNotFoundError, WorkoutNotFoundError } from '../ports/errors';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import {
  applyLiftOverrides,
  isValidWorkoutNum,
  toWorkoutResponse,
  weekForWorkoutNum,
} from './mappers';

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
    const { workout, cycleDashboard, liftingProgramSpec, workoutDateOverride, workoutLiftOverride } =
      await this.factory.forUser(user);
    const [dashboard, spec] = await Promise.all([
      cycleDashboard.getCycleDashboard(program).catch((err: unknown) => {
        if (err instanceof ProgramNotFoundError) return { cycleNum: 1 };
        throw err;
      }),
      liftingProgramSpec.getProgramSpec(program),
    ]);
    const week = weekForWorkoutNum(spec, workoutNum);
    if (week === undefined) {
      throw new BadRequestException(
        `workoutNum ${workoutNum} exceeds program spec (${new Set(spec.map((s) => s.offset)).size} workout days)`,
      );
    }

    // Spec lifts for this workout's week — used to build the planned lift list.
    const specLifts = [...new Set(spec.filter((s) => s.week === week).map((s) => s.lift))];

    const [records, overrideDate, liftOverrides] = await Promise.all([
      workout
        .getWorkout(program, dashboard.cycleNum, workoutNum)
        .catch((err: unknown) => {
          // Upcoming workouts have no logged records yet — treat as empty.
          if (err instanceof WorkoutNotFoundError) return [] as LiftRecord[];
          throw err;
        }),
      workoutDateOverride.getOverride(program, dashboard.cycleNum, workoutNum),
      workoutLiftOverride.getOverrides(program, dashboard.cycleNum, workoutNum),
    ]);

    const plannedLifts = applyLiftOverrides(specLifts, liftOverrides);

    // Apply overrides to logged records so removed/replaced lifts don't
    // re-appear via the "append ad-hoc logged lifts" path in toWorkoutResponse.
    const replaceMap = new Map(
      liftOverrides
        .filter((o): o is (typeof o) & { replacedBy: string } => o.action === 'replace' && !!o.replacedBy)
        .map((o) => [o.lift, o.replacedBy!]),
    );
    const removedLifts = new Set(liftOverrides.filter((o) => o.action === 'remove').map((o) => o.lift));
    const adjustedRecords = records
      .filter((r) => !removedLifts.has(r.lift))
      .map((r) => {
        const renamed = replaceMap.get(r.lift);
        return renamed !== undefined ? { ...r, lift: renamed } : r;
      });

    return toWorkoutResponse(
      program,
      dashboard.cycleNum,
      workoutNum,
      week,
      adjustedRecords,
      overrideDate ?? undefined,
      plannedLifts,
    );
  }
}
