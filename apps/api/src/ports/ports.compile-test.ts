/**
 * Compile-time contract tests for port interfaces.
 *
 * Each test assigns a mock object literal directly to the interface type.
 * If the mock is missing a required method or uses an incompatible signature,
 * the TypeScript compiler will error here — no runtime needed.
 */
import { CycleDashboard, LiftRecord, LiftingProgramSpec, TrainingMax, TrainingMaxHistoryEntry } from '@lifting-logbook/core';
import { BodyWeightEntry } from '@lifting-logbook/types';
import { AuthUser, IAuthProvider } from './auth';
import { IBodyWeightRepository } from './IBodyWeightRepository';
import { IRepositoryFactory, RepositoryBundle } from './factory';
import { ICycleDashboardRepository } from './ICycleDashboardRepository';
import { ILiftingProgramSpecRepository } from './ILiftingProgramSpecRepository';
import { ILiftRecordRepository } from './ILiftRecordRepository';
import { IProgramPhilosophyRepository } from './IProgramPhilosophyRepository';
import { ITrainingMaxRepository } from './ITrainingMaxRepository';
import { ITrainingMaxHistoryRepository } from './ITrainingMaxHistoryRepository';
import { IWorkoutRepository } from './IWorkoutRepository';

// ---------------------------------------------------------------------------
// IAuthProvider
// ---------------------------------------------------------------------------

const _authProvider: IAuthProvider = {
  verifyToken: (): Promise<AuthUser> =>
    Promise.resolve({ id: '1', email: 'test@example.com', provider: 'clerk' }),
};

// ---------------------------------------------------------------------------
// ICycleDashboardRepository
// ---------------------------------------------------------------------------

const _cycleDashboardRepo: ICycleDashboardRepository = {
  getCycleDashboard: (): Promise<CycleDashboard> =>
    Promise.resolve({} as CycleDashboard),
  saveCycleDashboard: (): Promise<void> =>
    Promise.resolve(),
};

// ---------------------------------------------------------------------------
// ILiftingProgramSpecRepository
// ---------------------------------------------------------------------------

const _programSpecRepo: ILiftingProgramSpecRepository = {
  getProgramSpec: (): Promise<LiftingProgramSpec[]> =>
    Promise.resolve([]),
};

// ---------------------------------------------------------------------------
// ILiftRecordRepository
// ---------------------------------------------------------------------------

const _liftRecordRepo: ILiftRecordRepository = {
  getLiftRecords: (): Promise<LiftRecord[]> =>
    Promise.resolve([]),
  appendLiftRecords: (): Promise<void> =>
    Promise.resolve(),
  updateLiftRecord: (): Promise<LiftRecord | null> =>
    Promise.resolve(null),
};

// ---------------------------------------------------------------------------
// IBodyWeightRepository
// ---------------------------------------------------------------------------

const _bodyWeightRepo: IBodyWeightRepository = {
  recordBodyWeight: (): Promise<void> =>
    Promise.resolve(),
  getLatestBodyWeight: (): Promise<BodyWeightEntry | null> =>
    Promise.resolve(null),
};

// ---------------------------------------------------------------------------
// ITrainingMaxRepository
// ---------------------------------------------------------------------------

const _trainingMaxRepo: ITrainingMaxRepository = {
  getTrainingMaxes: (): Promise<TrainingMax[]> =>
    Promise.resolve([]),
  saveTrainingMaxes: (): Promise<void> =>
    Promise.resolve(),
};

// ---------------------------------------------------------------------------
// ITrainingMaxHistoryRepository
// ---------------------------------------------------------------------------

const _trainingMaxHistoryRepo: ITrainingMaxHistoryRepository = {
  getHistory: (): Promise<TrainingMaxHistoryEntry[]> => Promise.resolve([]),
  appendHistoryEntries: (): Promise<void> => Promise.resolve(),
  updateHistoryEntry: (): Promise<TrainingMaxHistoryEntry> =>
    Promise.resolve({ id: '', lift: '', weight: 0, reps: 1, date: new Date(), isPR: false, source: 'program', goalMet: false }),
};

// IWorkoutRepository
// ---------------------------------------------------------------------------

const _workoutRepo: IWorkoutRepository = {
  getWorkout: (): Promise<LiftRecord[]> =>
    Promise.resolve([]),
  saveWorkout: (): Promise<void> =>
    Promise.resolve(),
};

// ---------------------------------------------------------------------------
// IRepositoryFactory
// ---------------------------------------------------------------------------

const _programPhilosophyRepo: IProgramPhilosophyRepository = {
  getProgramPhilosophy: () => Promise.resolve(null),
  listPrograms: () => Promise.resolve([]),
};

const _repositoryBundle: RepositoryBundle = {
  cycleDashboard: _cycleDashboardRepo,
  liftingProgramSpec: _programSpecRepo,
  liftRecord: _liftRecordRepo,
  programPhilosophy: _programPhilosophyRepo,
  trainingMax: _trainingMaxRepo,
  trainingMaxHistory: _trainingMaxHistoryRepo,
  workout: _workoutRepo,
};

const _repositoryFactory: IRepositoryFactory = {
  forUser: (): Promise<RepositoryBundle> => Promise.resolve(_repositoryBundle),
};

// Suppress "declared but never read" errors — these variables exist solely
// to trigger structural type checking at compile time.
void _authProvider;
void _bodyWeightRepo;
void _cycleDashboardRepo;
void _programSpecRepo;
void _liftRecordRepo;
void _trainingMaxRepo;
void _trainingMaxHistoryRepo;
void _workoutRepo;
void _repositoryBundle;
void _repositoryFactory;
