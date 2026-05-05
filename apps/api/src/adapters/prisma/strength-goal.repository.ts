import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { StrengthGoalEntry } from '@lifting-logbook/core';
import { IStrengthGoalRepository } from '../../ports/IStrengthGoalRepository';
import { StrengthGoalNotFoundError } from '../../ports/errors';

export class PrismaStrengthGoalRepository implements IStrengthGoalRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getGoals(program: string): Promise<StrengthGoalEntry[]> {
    const rows = await this.prisma.strengthGoal.findMany({
      where: { userId: this.userId, program },
      orderBy: { lift: 'asc' },
    });
    return rows.map((r) => ({
      lift: r.lift,
      goalType: r.goalType as 'absolute' | 'relative',
      target: r.target ?? undefined,
      unit: r.unit as 'lbs' | 'kg',
      ratio: r.ratio ?? undefined,
      updatedAt: r.updatedAt,
    }));
  }

  async upsertGoal(program: string, goal: StrengthGoalEntry): Promise<StrengthGoalEntry> {
    const row = await this.prisma.strengthGoal.upsert({
      where: { userId_program_lift: { userId: this.userId, program, lift: goal.lift } },
      update: { goalType: goal.goalType, target: goal.target ?? null, unit: goal.unit, ratio: goal.ratio ?? null },
      create: {
        userId: this.userId,
        program,
        lift: goal.lift,
        goalType: goal.goalType,
        target: goal.target ?? null,
        unit: goal.unit,
        ratio: goal.ratio ?? null,
      },
    });
    return {
      lift: row.lift,
      goalType: row.goalType as 'absolute' | 'relative',
      target: row.target ?? undefined,
      unit: row.unit as 'lbs' | 'kg',
      ratio: row.ratio ?? undefined,
      updatedAt: row.updatedAt,
    };
  }

  async deleteGoal(program: string, lift: string): Promise<void> {
    try {
      await this.prisma.strengthGoal.delete({
        where: { userId_program_lift: { userId: this.userId, program, lift } },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new StrengthGoalNotFoundError(lift);
      }
      throw e;
    }
  }
}
