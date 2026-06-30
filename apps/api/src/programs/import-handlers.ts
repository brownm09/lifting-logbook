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
  ImportPreImage,
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
  buildLiftRecordsPreImage,
  buildTrainingMaxPreImage,
  buildStrengthGoalPreImage,
  buildProgramSpecPreImage,
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
  ): Promise<Omit<ImportCommitResponse, 'destination' | 'batchId' | 'split'> & { preImage: ImportPreImage }>;
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
    const existingKeys = new Set(
      (await repos.liftRecord.findExistingRecords(program, records)).map(liftRecordNaturalKey),
    );
    const created = await repos.liftRecord.appendLiftRecords(program, records);
    const uniqueKeys = new Set(records.map(liftRecordNaturalKey)).size;
    const newRecords = records.filter((r) => !existingKeys.has(liftRecordNaturalKey(r)));
    return {
      created,
      updated: 0,
      skipped: uniqueKeys - created,
      preImage: buildLiftRecordsPreImage(newRecords),
    };
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
    const existing = await repos.trainingMax.getTrainingMaxes(program);
    const result = await repos.trainingMax.importTrainingMaxes(program, valid);
    return { ...result, preImage: buildTrainingMaxPreImage(valid, existing) };
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
    const existing = await repos.strengthGoal.getGoals(program);
    const result = await repos.strengthGoal.importGoals(program, valid);
    return { ...result, preImage: buildStrengthGoalPreImage(valid, existing) };
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
    const existing = await repos.liftingProgramSpec.getProgramSpec(program);
    const result = await repos.liftingProgramSpec.saveProgramSpec(program, valid);
    return { ...result, preImage: buildProgramSpecPreImage(valid, existing) };
  },
};

export const IMPORT_HANDLERS: Record<ImportKind, ImportHandler<LiftRecord | TrainingMax | StrengthGoalEntry | LiftingProgramSpec>> = {
  'lift-records': liftRecordsHandler,
  'training-maxes': trainingMaxesHandler,
  'strength-goals': strengthGoalsHandler,
  'program-spec': programSpecHandler,
};
