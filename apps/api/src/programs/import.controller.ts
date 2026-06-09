import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ImportCommitResponse,
  ImportError,
  ImportKind,
  ImportPreviewResponse,
} from '@lifting-logbook/types';
import {
  DEFAULT_SLOT_MAP,
  buildLiftRecordsPreview,
  buildProgramSpecPreview,
  buildStrengthGoalPreview,
  buildTrainingMaxPreview,
  classifyImport,
  liftRecordNaturalKey,
  parseCsvText,
  parseLiftRecords,
  parseLiftingProgramSpec,
  parseStrengthGoals,
  parseTrainingMaxes,
  validateLiftImport,
  validateProgramSpecImport,
  validateStrengthGoalImport,
  validateTrainingMaxImport,
} from '@lifting-logbook/core';
import type {
  LiftRecord,
  LiftingProgramSpec,
  SpreadsheetCell,
  StrengthGoalEntry,
  TrainingMax,
} from '@lifting-logbook/core';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { RepositoryBundle, IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { MAX_IMPORT_ROWS, readUploadedCsv } from './import-file.util';

const IMPORT_KINDS: readonly ImportKind[] = [
  'lift-records',
  'training-maxes',
  'strength-goals',
  'program-spec',
];

function asImportKind(value: unknown): ImportKind | null {
  return IMPORT_KINDS.includes(value as ImportKind) ? (value as ImportKind) : null;
}

/**
 * Unified Smart Import endpoint (#477).
 *
 * `mode=preview` (default) classifies the file and returns a per-kind before→after
 * preview without writing. `mode=commit` re-parses the uploaded file server-side
 * (never trusting any client payload) and writes idempotently. `destination`
 * overrides the classifier (required for commit; lets a low-confidence preview be
 * routed manually).
 */
@Controller('programs/:program')
export class ImportController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async import(
    @Param('program') program: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
    @Query('mode') mode = 'preview',
    @Query('destination') destinationParam?: string,
  ): Promise<ImportPreviewResponse | ImportCommitResponse> {
    const csvText = await readUploadedCsv(req);
    const table = parseCsvText(csvText);
    const override = asImportKind(destinationParam);

    if (mode === 'commit') {
      if (!override) {
        throw new BadRequestException('A valid `destination` is required to commit');
      }
      const repos = await this.factory.forUser(user);
      return this.commit(program, override, table, repos);
    }

    // Preview: classify, then resolve a destination (manual override wins over the
    // classifier so a user pick re-previews the chosen kind).
    const classification = classifyImport(table);
    const destination = override ?? classification.type;
    if (!destination) {
      return { classification, destination: null, preview: null, errors: [] };
    }
    const repos = await this.factory.forUser(user);
    const { errors, preview } = await this.preview(program, destination, table, repos);
    return { classification, destination, preview: errors.length ? null : preview, errors };
  }

  /** Parse + validate for a destination, then build a before→after preview (no writes). */
  private async preview(
    program: string,
    destination: ImportKind,
    table: SpreadsheetCell[][],
    repos: RepositoryBundle,
  ): Promise<{ errors: ImportError[]; preview: ImportPreviewResponse['preview'] }> {
    const { valid, errors } = this.parseAndValidate(destination, table);
    if (errors.length) return { errors, preview: null };

    switch (destination) {
      case 'lift-records': {
        const records = (valid as LiftRecord[]).map((r) => ({ ...r, program }));
        const existing = await repos.liftRecord.findExistingRecords(program, records);
        return { errors, preview: buildLiftRecordsPreview(records, existing) };
      }
      case 'training-maxes': {
        const existing = await repos.trainingMax.getTrainingMaxes(program);
        return { errors, preview: buildTrainingMaxPreview(valid as TrainingMax[], existing) };
      }
      case 'strength-goals': {
        const existing = await repos.strengthGoal.getGoals(program);
        return { errors, preview: buildStrengthGoalPreview(valid as StrengthGoalEntry[], existing) };
      }
      case 'program-spec': {
        const existing = await repos.liftingProgramSpec.getProgramSpec(program);
        return { errors, preview: buildProgramSpecPreview(valid as LiftingProgramSpec[], existing) };
      }
    }
  }

  /** Re-parse + validate + write for a destination (400 on validation errors). */
  private async commit(
    program: string,
    destination: ImportKind,
    table: SpreadsheetCell[][],
    repos: RepositoryBundle,
  ): Promise<ImportCommitResponse> {
    switch (destination) {
      case 'lift-records': {
        const valid = this.parseAndValidateOrThrow('lift-records', table) as LiftRecord[];
        const records = valid.map((r) => ({ ...r, program }));
        const uniqueKeys = new Set(records.map(liftRecordNaturalKey)).size;
        const created = await repos.liftRecord.appendLiftRecords(program, records);
        return { destination, created, updated: 0, skipped: uniqueKeys - created };
      }
      case 'training-maxes': {
        const valid = this.parseAndValidateOrThrow('training-maxes', table) as TrainingMax[];
        const existing = await repos.trainingMax.getTrainingMaxes(program);
        const { creates, updates, skips } = buildTrainingMaxPreview(valid, existing);
        await repos.trainingMax.saveTrainingMaxes(program, valid);
        return { destination, created: creates, updated: updates, skipped: skips };
      }
      case 'strength-goals': {
        const valid = this.parseAndValidateOrThrow('strength-goals', table) as StrengthGoalEntry[];
        const existing = await repos.strengthGoal.getGoals(program);
        const { creates, updates, skips } = buildStrengthGoalPreview(valid, existing);
        for (const goal of dedupeByLift(valid)) {
          await repos.strengthGoal.upsertGoal(program, goal);
        }
        return { destination, created: creates, updated: updates, skipped: skips };
      }
      case 'program-spec': {
        const valid = this.parseAndValidateOrThrow('program-spec', table) as LiftingProgramSpec[];
        const result = await repos.liftingProgramSpec.saveProgramSpec(program, valid);
        return { destination, ...result };
      }
    }
  }

  /**
   * Parses a table for a destination and validates it, returning `{ valid, errors }`.
   * Parse exceptions (e.g. a malformed training-max row) are surfaced as a row-0
   * validation error rather than a 500.
   */
  private parseAndValidate(
    destination: ImportKind,
    table: SpreadsheetCell[][],
  ): { valid: unknown[]; errors: ImportError[] } {
    let parsed: unknown[];
    try {
      parsed = this.parseFor(destination, table);
    } catch (err) {
      return { valid: [], errors: [{ row: 0, message: `Could not parse file: ${(err as Error).message}` }] };
    }
    if (parsed.length > MAX_IMPORT_ROWS) {
      return {
        valid: [],
        errors: [{ row: 0, message: `Import exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit. Split the file into smaller batches.` }],
      };
    }
    switch (destination) {
      case 'lift-records':
        return validateLiftImport(parsed as LiftRecord[], DEFAULT_SLOT_MAP);
      case 'training-maxes':
        return validateTrainingMaxImport(parsed as TrainingMax[]);
      case 'strength-goals':
        return validateStrengthGoalImport(parsed as StrengthGoalEntry[]);
      case 'program-spec':
        return validateProgramSpecImport(parsed as LiftingProgramSpec[]);
    }
  }

  private parseAndValidateOrThrow(destination: ImportKind, table: SpreadsheetCell[][]): unknown[] {
    const { valid, errors } = this.parseAndValidate(destination, table);
    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }
    return valid;
  }

  private parseFor(destination: ImportKind, table: SpreadsheetCell[][]): unknown[] {
    switch (destination) {
      case 'lift-records':
        return parseLiftRecords(table);
      case 'training-maxes':
        return parseTrainingMaxes(table);
      case 'strength-goals':
        return parseStrengthGoals(table);
      case 'program-spec':
        return parseLiftingProgramSpec(table);
    }
  }
}

/** Keeps the last entry per lift so a re-import with edits applies the latest value. */
function dedupeByLift<T extends { lift: string }>(rows: T[]): T[] {
  const byLift = new Map<string, T>();
  for (const r of rows) byLift.set(r.lift, r);
  return [...byLift.values()];
}
