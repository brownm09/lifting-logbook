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
    const { liftRecord } = await this.factory.forUser(user);
    const record = {
      program,
      cycleNum: body.cycleNum,
      workoutNum: body.workoutNum,
      date: new Date(body.date),
      lift: body.lift,
      setNum: body.setNum,
      weight: body.weight,
      reps: body.reps,
      notes: body.notes ?? '',
    };
    await liftRecord.appendLiftRecords(program, [record]);
    return toLiftRecordResponse(record);
  }

  @Post('lift-records/import')
  @HttpCode(HttpStatus.CREATED)
  async importLiftRecords(
    @Param('program') program: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<ImportLiftRecordsResponse> {
    // req.file() is provided by @fastify/multipart registered in main.ts
    const file = await (req as FastifyRequest & { file(): Promise<{ toBuffer(): Promise<Buffer> } | null> }).file();
    if (!file) throw new BadRequestException('No file uploaded');

    const csvText = (await file.toBuffer()).toString('utf-8');
    const table = parseCsvText(csvText);
    const parsed = parseLiftRecords(table);

    const { valid, errors } = validateLiftImport(parsed, DEFAULT_SLOT_MAP);
    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    // Stamp each record with the route program before persisting.
    const records = valid.map((r) => ({ ...r, program }));

    const { liftRecord } = await this.factory.forUser(user);
    const duplicates = await liftRecord.findExistingRecords(program, records);
    await liftRecord.appendLiftRecords(program, records);

    const dupKeys = new Set(
      duplicates.map((r) => `${r.cycleNum}:${r.workoutNum}:${r.lift}:${r.setNum}`),
    );
    const skipped: SkippedRecord[] = parsed
      .map((r, i) => ({ r, row: i + 1 }))
      .filter(({ r }) =>
        dupKeys.has(`${r.cycleNum}:${r.workoutNum}:${r.lift}:${r.setNum}`),
      )
      .map(({ r, row }) => ({
        row,
        naturalKey: `${r.cycleNum}:${r.workoutNum}:${r.lift}:${r.setNum}`,
      }));

    return { written: records.length - duplicates.length, skipped };
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
