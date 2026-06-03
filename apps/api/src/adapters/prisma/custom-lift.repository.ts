import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CustomLift, LiftClassification, MovementTag } from '@lifting-logbook/types';
import {
  CreateCustomLiftInput,
  ICustomLiftRepository,
  UpdateCustomLiftPatch,
} from '../../ports/ICustomLiftRepository';
import { CustomLiftConflictError, CustomLiftNotFoundError } from '../../ports/errors';

interface CustomLiftRow {
  id: string;
  userId: string;
  name: string;
  classification: string;
  movementTags: string[];
  isBodyweightComponent: boolean;
  createdAt: Date;
}

export class PrismaCustomLiftRepository implements ICustomLiftRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async list(): Promise<CustomLift[]> {
    const rows = await this.prisma.customLift.findMany({
      where: { userId: this.userId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r: CustomLiftRow) => this.toCustomLift(r));
  }

  async create(input: CreateCustomLiftInput): Promise<CustomLift> {
    try {
      const row = await this.prisma.customLift.create({
        data: {
          userId: this.userId,
          name: input.name,
          classification: input.classification,
          movementTags: input.movementTags ?? [],
          isBodyweightComponent: input.isBodyweightComponent ?? false,
        },
      });
      return this.toCustomLift(row);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new CustomLiftConflictError(input.name);
      }
      throw e;
    }
  }

  async update(id: string, patch: UpdateCustomLiftPatch): Promise<CustomLift> {
    // The PK is `id` alone, so guard on userId to preserve ownership isolation —
    // a bare where:{id} would let one user mutate another user's lift.
    const owned = await this.prisma.customLift.findFirst({ where: { id, userId: this.userId } });
    if (!owned) {
      throw new CustomLiftNotFoundError(id);
    }
    const data = {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.classification !== undefined ? { classification: patch.classification } : {}),
      ...(patch.movementTags !== undefined ? { movementTags: patch.movementTags } : {}),
      ...(patch.isBodyweightComponent !== undefined
        ? { isBodyweightComponent: patch.isBodyweightComponent }
        : {}),
    };
    try {
      const row = await this.prisma.customLift.update({ where: { id }, data });
      return this.toCustomLift(row);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new CustomLiftConflictError(patch.name ?? owned.name);
      }
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    // Guard on userId for the same isolation reason as update().
    const owned = await this.prisma.customLift.findFirst({ where: { id, userId: this.userId } });
    if (!owned) {
      throw new CustomLiftNotFoundError(id);
    }
    await this.prisma.customLift.delete({ where: { id } });
  }

  private toCustomLift(row: CustomLiftRow): CustomLift {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      classification: row.classification as LiftClassification,
      movementTags: row.movementTags as MovementTag[],
      isBodyweightComponent: row.isBodyweightComponent,
      isCustom: true,
      createdAt: row.createdAt,
    };
  }
}
