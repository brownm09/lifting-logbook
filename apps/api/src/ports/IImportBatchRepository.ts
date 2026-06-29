import { ImportPreImage } from '@lifting-logbook/core';
import { ImportKind } from '@lifting-logbook/types';

export interface ImportBatchRecord {
  id: string;
  userId: string;
  program: string;
  destination: ImportKind;
  preImage: ImportPreImage;
  createdAt: Date;
}

export interface IImportBatchRepository {
  save(batch: ImportBatchRecord): Promise<void>;
  findById(id: string, userId: string): Promise<ImportBatchRecord | null>;
}
