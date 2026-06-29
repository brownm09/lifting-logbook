import {
  ImportError,
  ImportKind,
  ImportPreviewResponse,
  ImportCommitResponse,
} from '@lifting-logbook/types';
import {
  SpreadsheetCell,
  LiftRecord,
  TrainingMax,
  StrengthGoalEntry,
  LiftingProgramSpec,
  parseLiftRecords,
  parseTrainingMaxes,
  parseStrengthGoals,
  parseLiftingProgramSpec,
  validateLiftImport,
  validateTrainingMaxImport,
  validateStrengthGoalImport,
  validateProgramSpecImport,
  buildLiftRecordsPreview,
  buildTrainingMaxPreview,
  buildStrengthGoalPreview,
  buildProgramSpecPreview,
  liftRecordNaturalKey,
  DEFAULT_SLOT_MAP,
} from '@lifting-logbook/core';
import { RepositoryBundle } from '../ports/factory';

export interface ImportHandler<T> {
  parse(table: SpreadsheetCell[][]): T[];
  validate(parsed: T[]): { valid: T[]; errors: ImportError[] };
  preview(
    valid: T[],
    program: string,
    repos: RepositoryBundle,
  ): Promise<ImportPreviewResponse['preview']>;
  commit(
    valid: T[],
    program: string,
    repos: RepositoryBundle,
  ): Promise<Omit<ImportCommitResponse, 'destination'>>;
}

const liftRecordsHandler: ImportHandler<LiftRecord> = {
  parse: parseLiftRecords,
  validate: (parsed) => validateLiftImport(parsed, DEFAULT_SLOT_MAP),
  async preview(valid, program, repos) {
    const records = valid.map((r) => ({ ...r, program }));
    const existing = await repos.liftRecord.findExistingRecords(program, records);
    return buildLiftRecordsPreview(records, existing);
  },
  async commit(valid, program, repos) {
    const records = valid.map((r) => ({ ...r, program }));
    const uniqueKeys = new Set(records.map(liftRecordNaturalKey)).size;
    const created = await repos.liftRecord.appendLiftRecords(program, records);
    return { created, updated: 0, skipped: uniqueKeys - created };
  },
};

const trainingMaxesHandler: ImportHandler<TrainingMax> = {
  parse: parseTrainingMaxes,
  validate: validateTrainingMaxImport,
  async preview(valid, program, repos) {
    const existing = await repos.trainingMax.getTrainingMaxes(program);
    return buildTrainingMaxPreview(valid, existing);
  },
  async commit(valid, program, repos) {
    return repos.trainingMax.importTrainingMaxes(program, valid);
  },
};

const strengthGoalsHandler: ImportHandler<StrengthGoalEntry> = {
  parse: parseStrengthGoals,
  validate: validateStrengthGoalImport,
  async preview(valid, program, repos) {
    const existing = await repos.strengthGoal.getGoals(program);
    return buildStrengthGoalPreview(valid, existing);
  },
  async commit(valid, program, repos) {
    return repos.strengthGoal.importGoals(program, valid);
  },
};

const programSpecHandler: ImportHandler<LiftingProgramSpec> = {
  parse: parseLiftingProgramSpec,
  validate: validateProgramSpecImport,
  async preview(valid, program, repos) {
    const existing = await repos.liftingProgramSpec.getProgramSpec(program);
    return buildProgramSpecPreview(valid, existing);
  },
  async commit(valid, program, repos) {
    return repos.liftingProgramSpec.saveProgramSpec(program, valid);
  },
};

export const IMPORT_HANDLERS: Record<ImportKind, ImportHandler<LiftRecord | TrainingMax | StrengthGoalEntry | LiftingProgramSpec>> = {
  'lift-records': liftRecordsHandler,
  'training-maxes': trainingMaxesHandler,
  'strength-goals': strengthGoalsHandler,
  'program-spec': programSpecHandler,
};
