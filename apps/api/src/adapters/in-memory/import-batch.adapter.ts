import { IImportBatchRepository, ImportBatchRecord } from '../../ports/IImportBatchRepository';

export class InMemoryImportBatchRepository implements IImportBatchRepository {
  private readonly store = new Map<string, ImportBatchRecord>();

  async save(batch: ImportBatchRecord): Promise<void> {
    this.store.set(batch.id, batch);
  }

  async findById(id: string, userId: string): Promise<ImportBatchRecord | null> {
    const record = this.store.get(id);
    if (!record || record.userId !== userId) return null;
    return record;
  }

  async deleteById(id: string, userId: string): Promise<void> {
    const record = this.store.get(id);
    if (record && record.userId === userId) this.store.delete(id);
  }
}
