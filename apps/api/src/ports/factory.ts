import { AuthUser } from './auth';
import { ICycleDashboardRepository } from './ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from './ILiftingProgramSpecRepository';
import { ILiftRecordRepository } from './ILiftRecordRepository';
import { ITrainingMaxRepository } from './ITrainingMaxRepository';
import { IWorkoutRepository } from './IWorkoutRepository';

export interface RepositoryBundle {
  cycleDashboard: ICycleDashboardRepository;
  liftingProgramSpec: ILiftingProgramSpecRepository;
  liftRecord: ILiftRecordRepository;
  trainingMax: ITrainingMaxRepository;
  workout: IWorkoutRepository;
}

export interface IRepositoryFactory {
  forUser(user: AuthUser): Promise<RepositoryBundle>;
}
