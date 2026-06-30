import { PrismaClient } from '@prisma/client';
import { ImportPreImage } from '@lifting-logbook/core';
import { ImportKind } from '@lifting-logbook/types';
import { IImportBatchRepository, ImportBatchRecord } from '../../ports/IImportBatchRepository';

export class PrismaImportBatchRepository implements IImportBatchRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async save(batch: ImportBatchRecord): Promise<void> {
    await this.prisma.importBatch.create({
      data: {
        id: batch.id,
        userId: this.userId,
        program: batch.program,
        destination: batch.destination,
        preImage: batch.preImage as object,
      },
    });
  }

  async findById(id: string, userId: string): Promise<ImportBatchRecord | null> {
    const row = await this.prisma.importBatch.findFirst({
      where: { id, userId },
    });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      program: row.program,
      destination: row.destination as ImportKind,
      preImage: row.preImage as unknown as ImportPreImage,
      createdAt: row.createdAt,
    };
  }

  async deleteById(id: string, userId: string): Promise<void> {
    await this.prisma.importBatch.deleteMany({ where: { id, userId } });
  }
}
