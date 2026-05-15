import { NotFoundException } from '@nestjs/common';
import {
  CustomProgramResponse,
  CustomProgramSummaryResponse,
  CustomProgramSpecRow,
} from '@lifting-logbook/types';
import { PrismaService } from '../adapters/prisma/prisma.service';
import { LiftingProgramSpec } from '@lifting-logbook/core';

function toSpecRow(s: {
  week: number;
  offset: number;
  lift: string;
  increment: number;
  order: number;
  sets: number;
  reps: number;
  amrap: boolean;
  warmUpPct: string;
  wtDecrementPct: number;
  activation: string;
  weekType: string | null;
}): CustomProgramSpecRow {
  return {
    week: s.week,
    offset: s.offset,
    lift: s.lift,
    increment: s.increment,
    order: s.order,
    sets: s.sets,
    reps: s.reps,
    amrap: s.amrap,
    warmUpPct: s.warmUpPct,
    wtDecrementPct: s.wtDecrementPct,
    activation: s.activation,
    weekType: s.weekType ?? undefined,
  };
}

export class CustomProgramsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userId: string,
  ) {}

  async list(): Promise<CustomProgramSummaryResponse[]> {
    const rows = await this.prisma.customProgram.findMany({
      where: { userId: this.userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      baseTemplate: r.baseTemplate,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async get(id: string): Promise<CustomProgramResponse> {
    const row = await this.prisma.customProgram.findFirst({
      where: { id, userId: this.userId },
      include: { specs: { orderBy: [{ week: 'asc' }, { order: 'asc' }] } },
    });
    if (!row) throw new NotFoundException(`Custom program ${id} not found`);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      baseTemplate: row.baseTemplate,
      createdAt: row.createdAt.toISOString(),
      specs: row.specs.map(toSpecRow),
    };
  }

  async create(data: {
    name: string;
    description?: string;
    baseTemplate?: string;
    specs: CustomProgramSpecRow[];
  }): Promise<CustomProgramResponse> {
    const row = await this.prisma.customProgram.create({
      data: {
        userId: this.userId,
        name: data.name,
        description: data.description ?? null,
        baseTemplate: data.baseTemplate ?? null,
        specs: {
          create: data.specs.map((s) => ({
            week: s.week,
            offset: s.offset,
            lift: s.lift,
            increment: s.increment,
            order: s.order,
            sets: s.sets,
            reps: s.reps,
            amrap: s.amrap,
            warmUpPct: s.warmUpPct,
            wtDecrementPct: s.wtDecrementPct,
            activation: s.activation,
            weekType: s.weekType ?? null,
          })),
        },
      },
      include: { specs: { orderBy: [{ week: 'asc' }, { order: 'asc' }] } },
    });
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      baseTemplate: row.baseTemplate,
      createdAt: row.createdAt.toISOString(),
      specs: row.specs.map(toSpecRow),
    };
  }

  async update(
    id: string,
    data: { name?: string; description?: string; specs?: CustomProgramSpecRow[] },
  ): Promise<CustomProgramResponse> {
    const existing = await this.prisma.customProgram.findFirst({
      where: { id, userId: this.userId },
    });
    if (!existing) throw new NotFoundException(`Custom program ${id} not found`);

    const updatePayload: {
      name?: string;
      description?: string | null;
      specs?: { deleteMany: object; create: object[] };
    } = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description ?? null;
    if (data.specs !== undefined) {
      updatePayload.specs = {
        deleteMany: {},
        create: data.specs.map((s) => ({
          week: s.week,
          offset: s.offset,
          lift: s.lift,
          increment: s.increment,
          order: s.order,
          sets: s.sets,
          reps: s.reps,
          amrap: s.amrap,
          warmUpPct: s.warmUpPct,
          wtDecrementPct: s.wtDecrementPct,
          activation: s.activation,
          weekType: s.weekType ?? null,
        })),
      };
    }

    const row = await this.prisma.customProgram.update({
      where: { id },
      data: updatePayload,
      include: { specs: { orderBy: [{ week: 'asc' }, { order: 'asc' }] } },
    });
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      baseTemplate: row.baseTemplate,
      createdAt: row.createdAt.toISOString(),
      specs: row.specs.map(toSpecRow),
    };
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.customProgram.findFirst({
      where: { id, userId: this.userId },
    });
    if (!existing) throw new NotFoundException(`Custom program ${id} not found`);
    await this.prisma.customProgram.delete({ where: { id } });
  }

  async getSpec(id: string): Promise<LiftingProgramSpec[]> {
    const specs = await this.prisma.customProgramSpec.findMany({
      where: { programId: id },
      orderBy: [{ week: 'asc' }, { order: 'asc' }],
    });
    return specs.map((s) => ({
      week: s.week as 1 | 2 | 3,
      offset: s.offset,
      lift: s.lift,
      increment: s.increment,
      order: s.order,
      sets: s.sets,
      reps: s.reps,
      amrap: s.amrap,
      warmUpPct: s.warmUpPct,
      wtDecrementPct: s.wtDecrementPct,
      activation: s.activation,
      weekType: (s.weekType as 'training' | 'test' | 'deload' | undefined) ?? undefined,
    }));
  }
}
