import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Req,
} from '@nestjs/common';
import {
  CreateLiftRecordRequest,
  ImportLiftRecordsResponse,
  LiftRecordResponse,
  SkippedRecord,
  UpdateLiftRecordRequest,
} from '@lifting-logbook/types';
import {
  DEFAULT_SLOT_MAP,
  liftRecordNaturalKey,
  parseCsvText,
  parseLiftRecords,
  validateLiftImport,
} from '@lifting-logbook/core';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { toLiftRecordResponse } from './mappers';

@Controller('programs/:program')
export class LiftRecordsController {
  constructor(
    @Inject(REPOSITORY_FACTORY) private readonly factory: IRepositoryFactory,
  ) {}

  @Get('lift-records')
  async getLiftRecords(
    @Param('program') program: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LiftRecordResponse[]> {
    const { liftRecord, cycleDashboard } = await this.factory.forUser(user);
    const dashboard = await cycleDashboard.getCycleDashboard(program);
    const records = await liftRecord.getLiftRecords(program, dashboard.cycleNum);
    return records.map(toLiftRecordResponse);
  }

  @Post('lift-records')
  @HttpCode(HttpStatus.CREATED)
  async createLiftRecord(
    @Param('program') program: string,
    @Body() body: CreateLiftRecordRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<LiftRecordResponse> {
    const { liftRecord, cycleScheduledWorkout } = await this.factory.forUser(user);

    let effectiveDate: Date;
    if (body.date) {
      effectiveDate = new Date(body.date);
    } else {
      const scheduled = await cycleScheduledWorkout.getScheduledWorkouts(program, body.cycleNum);
      const match = scheduled.find((s) => s.workoutNum === body.workoutNum);
      effectiveDate = match?.scheduledDate ?? new Date();
    }

    const record = {
      program,
      cycleNum: body.cycleNum,
      workoutNum: body.workoutNum,
      date: effectiveDate,
      lift: body.lift,
      setNum: body.setNum,
      weight: body.weight,
      reps: body.reps,
      notes: body.notes ?? '',
    };
    await liftRecord.appendLiftRecords(program, [record]);
    return toLiftRecordResponse(record);
  }

  /**
   * Imports historical lift records from a CSV file.
   *
   * Validation is all-or-nothing: if any row fails, the entire upload is rejected
   * with 400 and no records are written.
   *
   * Lift abbreviations (e.g. "Bench P.") are resolved to canonical lift IDs
   * (e.g. "bench-press") via the DEFAULT_SLOT_MAP. Programs do not restrict which
   * lifts may be imported — all lifts present in the slot map are accepted for any
   * program. (Preloaded template programs become custom programs when edited; custom
   * programs have no lift restrictions.)
   *
   * Rows whose natural key (cycleNum, workoutNum, lift, setNum) already exists for
   * the program are silently skipped and reported in the `skipped` response field.
   * The `written` count reflects actual rows inserted by the database (via
   * `createMany({ skipDuplicates: true })`), not a client-side estimate.
   */
  @Post('lift-records/import')
  @HttpCode(HttpStatus.CREATED)
  async importLiftRecords(
    @Param('program') program: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<ImportLiftRecordsResponse> {
    // Maximum rows accepted per import. Guards against unbounded OR queries in
    // findExistingRecords and excessive memory usage during parsing.
    const MAX_IMPORT_ROWS = 5_000;

    // req.file() is provided by @fastify/multipart registered in main.ts.
    const file = await (req as FastifyRequest & {
      file(): Promise<{ toBuffer(): Promise<Buffer>; file: { truncated: boolean } } | null>;
    }).file();
    if (!file) throw new BadRequestException('No file uploaded');

    let csvBuffer: Buffer;
    try {
      csvBuffer = await file.toBuffer();
    } catch (err) {
      // @fastify/multipart throws with code FST_REQ_FILE_TOO_LARGE when the
      // file exceeds the configured fileSize limit.
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new PayloadTooLargeException('File exceeds the 5 MB upload limit');
      }
      throw err;
    }
    // Also handle the case where @fastify/multipart truncates instead of throwing.
    if (file.file.truncated) {
      throw new PayloadTooLargeException('File exceeds the 5 MB upload limit');
    }

    const csvText = csvBuffer.toString('utf-8');
    const table = parseCsvText(csvText);
    const parsed = parseLiftRecords(table);

    if (parsed.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Import exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit. ` +
          `Split the file into smaller batches.`,
      );
    }

    const { valid, errors } = validateLiftImport(parsed, DEFAULT_SLOT_MAP);
    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    // Stamp each record with the route program before persisting.
    const records = valid.map((r) => ({ ...r, program }));

    const { liftRecord } = await this.factory.forUser(user);
    const duplicates = await liftRecord.findExistingRecords(program, records);

    // `written` comes directly from the database's createMany count so it is
    // accurate even if a concurrent import caused additional rows to be skipped.
    const written = await liftRecord.appendLiftRecords(program, records);

    const dupKeys = new Set(duplicates.map(liftRecordNaturalKey));
    // Build skipped from `records` (canonical lift IDs), not `parsed` (CSV abbreviations),
    // so the naturalKey strings match what findExistingRecords returned.
    const skipped: SkippedRecord[] = records
      .map((r, i) => ({ r, row: i + 1 }))
      .filter(({ r }) => dupKeys.has(liftRecordNaturalKey(r)))
      .map(({ r, row }) => ({ row, naturalKey: liftRecordNaturalKey(r) }));

    return { written, skipped };
  }

  @Patch('lift-records/:id')
  async updateLiftRecord(
    @Param('program') program: string,
    @Param('id') id: string,
    @Body() body: UpdateLiftRecordRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<LiftRecordResponse> {
    const { liftRecord } = await this.factory.forUser(user);
    const updated = await liftRecord.updateLiftRecord(program, id, body);
    if (!updated) {
      throw new NotFoundException(
        `Lift record '${id}' not found for program '${program}'`,
      );
    }
    return toLiftRecordResponse(updated);
  }
}
