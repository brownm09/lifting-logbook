import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
} from '@nestjs/common';
import { baseSpecBlockWeeks, LiftRecord } from '@lifting-logbook/core';
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
    const { workout, cycleDashboard, cycleScheduledWorkout, liftingProgramSpec, workoutDateOverride, workoutLiftOverride, workoutSkipOverride } =
      await this.factory.forUser(user);
    const [dashboard, spec] = await Promise.all([
      // fallback-covered-by: apps/api/src/programs/workouts.controller.spec.ts
      cycleDashboard.getCycleDashboard(program).catch((err: unknown) => {
        if (err instanceof ProgramNotFoundError) return { cycleNum: 1 };
        throw err;
      }),
      liftingProgramSpec.getProgramSpec(program),
    ]);
    const [records, overrideDate, liftOverrides, scheduledWorkouts, skippedNums] = await Promise.all([
      // fallback-covered-by: apps/api/src/programs/workouts.controller.spec.ts
      workout
        .getWorkout(program, dashboard.cycleNum, workoutNum)
        .catch((err: unknown) => {
          // Upcoming workouts have no logged records yet — treat as empty.
          if (err instanceof WorkoutNotFoundError) return [] as LiftRecord[];
          throw err;
        }),
      workoutDateOverride.getOverride(program, dashboard.cycleNum, workoutNum),
      workoutLiftOverride.getOverrides(program, dashboard.cycleNum, workoutNum),
      cycleScheduledWorkout.getScheduledWorkouts(program, dashboard.cycleNum),
      // fallback-covered-by: apps/api/src/programs/workouts.controller.spec.ts
      workoutSkipOverride.getSkipsForCycle(program, dashboard.cycleNum).catch((err: unknown) => {
        console.error('[WorkoutsController] getSkipsForCycle failed; defaulting to empty set', err);
        return new Set<number>();
      }),
    ]);
    const scheduledWorkout = scheduledWorkouts.find((s) => s.workoutNum === workoutNum);
    const scheduledDate = scheduledWorkout?.scheduledDate;

    // The scheduled row's weekNum is authoritative for the program week. A global
    // workoutNum spans the full tiled schedule, so it can exceed the base block's
    // distinct-offset count — weekForWorkoutNum (offset-indexed within one block)
    // only covers the no-schedule fallback. Without this, week-2+ workouts of a
    // tiled program (Leangains 12w, 5-3-1 12w) would 400 (issue #680).
    const week = scheduledWorkout?.weekNum ?? weekForWorkoutNum(spec, workoutNum);
    if (week === undefined) {
      throw new BadRequestException(
        `workoutNum ${workoutNum} exceeds program spec (${new Set(spec.map((s) => s.offset)).size} workout days)`,
      );
    }

    // Planned lifts come from the tiled block week: the stored spec is one block,
    // so map the program week (which may exceed blockWeeks) back into the block.
    const blockWeeks = baseSpecBlockWeeks(spec);
    const blockWeek = blockWeeks > 0 ? ((week - 1) % blockWeeks) + 1 : week;
    const specLifts = [...new Set(spec.filter((s) => s.week === blockWeek).map((s) => s.lift))];

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
      scheduledDate,
      skippedNums.has(workoutNum),
    );
  }
}
