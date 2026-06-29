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
  classifyImport,
  parseCsvText,
} from '@lifting-logbook/core';
import type {
  SpreadsheetCell,
} from '@lifting-logbook/core';
import { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../ports/auth';
import { RepositoryBundle, IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { RlsTxTimeout } from '../adapters/prisma/rls-context';
import { IMPORT_TX_TIMEOUT_MS } from '../adapters/prisma/prisma-tx.util';
import { MAX_IMPORT_ROWS, readUploadedCsv } from './import-file.util';
import { IMPORT_HANDLERS } from './import-handlers';

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
  // Commit re-writes the whole import in one transaction; widen the RLS request-tx
  // window to the import budget so a large (within-limit) file does not P2028 at the
  // 15s default. Reuses the same constant the self-opened-tx path uses (#532).
  @RlsTxTimeout(IMPORT_TX_TIMEOUT_MS)
  async import(
    @Param('program') program: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
    @Query('mode') mode = 'preview',
    @Query('destination') destinationParam?: string,
  ): Promise<ImportPreviewResponse | ImportCommitResponse> {
    const csvText = await readUploadedCsv(req);
    const table = parseCsvText(csvText);
    const override = destinationParam && (Object.keys(IMPORT_HANDLERS) as ImportKind[]).includes(
      destinationParam as ImportKind,
    ) ? (destinationParam as ImportKind) : null;

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

    const handler = IMPORT_HANDLERS[destination]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handler signatures are generic across four types; type narrowing from destination covers safety
    const previewResult = await handler.preview(valid as any, program, repos);
    return { errors, preview: previewResult };
  }

  /** Re-parse + validate + write for a destination (400 on validation errors). */
  private async commit(
    program: string,
    destination: ImportKind,
    table: SpreadsheetCell[][],
    repos: RepositoryBundle,
  ): Promise<ImportCommitResponse> {
    const valid = this.parseAndValidateOrThrow(destination, table);
    const handler = IMPORT_HANDLERS[destination]!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handler signatures are generic across four types; type narrowing from destination covers safety
    const result = await handler.commit(valid as any, program, repos);
    return { destination, ...result };
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
    const handler = IMPORT_HANDLERS[destination]!;
    let parsed: unknown[];
    try {
      parsed = handler.parse(table);
    } catch (err) {
      return { valid: [], errors: [{ row: 0, message: `Could not parse file: ${(err as Error).message}` }] };
    }
    if (parsed.length > MAX_IMPORT_ROWS) {
      return {
        valid: [],
        errors: [{ row: 0, message: `Import exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit. Split the file into smaller batches.` }],
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handler signatures are generic across four types; type narrowing from destination covers safety
    return handler.validate(parsed as any);
  }

  private parseAndValidateOrThrow(destination: ImportKind, table: SpreadsheetCell[][]): unknown[] {
    const { valid, errors } = this.parseAndValidate(destination, table);
    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }
    return valid;
  }
}
