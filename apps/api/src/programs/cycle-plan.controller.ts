import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { CyclePlanResponse } from '@lifting-logbook/types';
import {
  CYCLE_DASHBOARD_REPOSITORY,
  CYCLE_PLANNING_AGENT,
  ICycleDashboardRepository,
  ICyclePlanningAgent,
  ILiftingProgramSpecRepository,
  ILiftRecordRepository,
  IProgramPhilosophyRepository,
  ITrainingMaxRepository,
  IWorkoutRepository,
  LIFTING_PROGRAM_SPEC_REPOSITORY,
  LIFT_RECORD_REPOSITORY,
  PROGRAM_PHILOSOPHY_REPOSITORY,
  RepositoryBundle,
  TRAINING_MAX_REPOSITORY,
  WORKOUT_REPOSITORY,
} from '../ports';
import { CyclePlanRequestDto } from './cycle-plan.dto';
import { toCyclePlanResponse } from './mappers';

@Controller('cycle-plan')
export class CyclePlanController {
  constructor(
    @Inject(CYCLE_PLANNING_AGENT)
    private readonly agent: ICyclePlanningAgent,
    @Inject(CYCLE_DASHBOARD_REPOSITORY)
    private readonly cycleDashboard: ICycleDashboardRepository,
    @Inject(LIFTING_PROGRAM_SPEC_REPOSITORY)
    private readonly liftingProgramSpec: ILiftingProgramSpecRepository,
    @Inject(LIFT_RECORD_REPOSITORY)
    private readonly liftRecord: ILiftRecordRepository,
    @Inject(PROGRAM_PHILOSOPHY_REPOSITORY)
    private readonly programPhilosophy: IProgramPhilosophyRepository,
    @Inject(TRAINING_MAX_REPOSITORY)
    private readonly trainingMax: ITrainingMaxRepository,
    @Inject(WORKOUT_REPOSITORY)
    private readonly workout: IWorkoutRepository,
  ) {}

  /**
   * POST /cycle-plan
   *
   * Runs the cycle planning agent. Returns proposed training-max changes and
   * overall reasoning. `partial: true` indicates the agent did not converge
   * (timeout, tool budget exhausted, malformed model output).
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async plan(@Body() dto: CyclePlanRequestDto): Promise<CyclePlanResponse> {
    const repos: RepositoryBundle = {
      cycleDashboard: this.cycleDashboard,
      liftingProgramSpec: this.liftingProgramSpec,
      liftRecord: this.liftRecord,
      programPhilosophy: this.programPhilosophy,
      trainingMax: this.trainingMax,
      workout: this.workout,
    };
    const result = await this.agent.plan(repos, {
      program: dto.program,
      goal: dto.goal,
      cycleNum: dto.cycleNum,
    });
    return toCyclePlanResponse(result);
  }
}
