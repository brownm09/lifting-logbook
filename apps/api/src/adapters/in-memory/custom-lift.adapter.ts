import { randomUUID } from 'crypto';
import { CustomLift } from '@lifting-logbook/types';
import {
  CreateCustomLiftInput,
  ICustomLiftRepository,
  UpdateCustomLiftPatch,
} from '../../ports/ICustomLiftRepository';
import { CustomLiftConflictError, CustomLiftNotFoundError } from '../../ports/errors';

export class InMemoryCustomLiftRepository implements ICustomLiftRepository {
  // Keyed by uuid id (the REST key), not name — names are mutable.
  private readonly store = new Map<string, CustomLift>();

  constructor(private readonly userId: string) {}

  async list(): Promise<CustomLift[]> {
    return Array.from(this.store.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(input: CreateCustomLiftInput): Promise<CustomLift> {
    if (this.nameTaken(input.name)) {
      throw new CustomLiftConflictError(input.name);
    }
    const lift: CustomLift = {
      id: randomUUID(),
      userId: this.userId,
      name: input.name,
      classification: input.classification,
      movementProfile: input.movementProfile ?? { patterns: [], jointActions: [], complexity: 'simple' },
      isBodyweightComponent: input.isBodyweightComponent ?? false,
      isCustom: true,
      createdAt: new Date(),
    };
    this.store.set(lift.id, lift);
    return lift;
  }

  async update(id: string, patch: UpdateCustomLiftPatch): Promise<CustomLift> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new CustomLiftNotFoundError(id);
    }
    if (patch.name !== undefined && this.nameTaken(patch.name, id)) {
      throw new CustomLiftConflictError(patch.name);
    }
    const updated: CustomLift = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.classification !== undefined ? { classification: patch.classification } : {}),
      ...(patch.movementProfile !== undefined ? { movementProfile: patch.movementProfile } : {}),
      ...(patch.isBodyweightComponent !== undefined
        ? { isBodyweightComponent: patch.isBodyweightComponent }
        : {}),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new CustomLiftNotFoundError(id);
    }
    this.store.delete(id);
  }

  private nameTaken(name: string, exceptId?: string): boolean {
    for (const lift of this.store.values()) {
      if (lift.name === name && lift.id !== exceptId) return true;
    }
    return false;
  }
}
