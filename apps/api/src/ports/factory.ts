import { AuthUser } from './auth';
import { ICycleDashboardRepository } from './ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from './ILiftingProgramSpecRepository';
import { ILiftRecordRepository } from './ILiftRecordRepository';
import { IProgramPhilosophyRepository } from './IProgramPhilosophyRepository';
import { IStrengthGoalRepository } from './IStrengthGoalRepository';
import { ITrainingMaxHistoryRepository } from './ITrainingMaxHistoryRepository';
import { ITrainingMaxRepository } from './ITrainingMaxRepository';
import { IWorkoutDateOverrideRepository } from './IWorkoutDateOverrideRepository';
import { IWorkoutLiftOverrideRepository } from './IWorkoutLiftOverrideRepository';
import { IWorkoutRepository } from './IWorkoutRepository';

export interface RepositoryBundle {
  cycleDashboard: ICycleDashboardRepository;
  liftingProgramSpec: ILiftingProgramSpecRepository;
  liftRecord: ILiftRecordRepository;
  programPhilosophy: IProgramPhilosophyRepository;
  strengthGoal: IStrengthGoalRepository;
  trainingMax: ITrainingMaxRepository;
  trainingMaxHistory: ITrainingMaxHistoryRepository;
  workout: IWorkoutRepository;
  workoutDateOverride: IWorkoutDateOverrideRepository;
  workoutLiftOverride: IWorkoutLiftOverrideRepository;
}

export interface IRepositoryFactory {
  forUser(user: AuthUser): Promise<RepositoryBundle>;
}
