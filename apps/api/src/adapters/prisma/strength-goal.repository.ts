import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { StrengthGoalEntry, classifyAndCount, strengthGoalRowKind } from '@lifting-logbook/core';
import { ImportWriteResult } from '@lifting-logbook/types';
import { IStrengthGoalRepository } from '../../ports/IStrengthGoalRepository';
import { StrengthGoalNotFoundError } from '../../ports/errors';
import { IMPORT_BATCH_TX_OPTIONS, runInteractive } from './prisma-tx.util';

type StrengthGoalRow = {
  lift: string;
  goalType: string;
  unit: string;
  updatedAt: Date;
  target: number | null;
  ratio: number | null;
};

/** Map a persisted strength-goal row to the domain entry (nullable cols → optional fields). */
function rowToEntry(r: StrengthGoalRow): StrengthGoalEntry {
  return {
    lift: r.lift,
    goalType: r.goalType as 'absolute' | 'relative',
    unit: r.unit as 'lbs' | 'kg',
    updatedAt: r.updatedAt,
    ...(r.target != null ? { target: r.target } : {}),
    ...(r.ratio != null ? { ratio: r.ratio } : {}),
  };
}

/** Domain entry → persistence columns (optional fields → SQL NULL). */
function entryToData(goal: StrengthGoalEntry) {
  return {
    goalType: goal.goalType,
    target: goal.target ?? null,
    unit: goal.unit,
    ratio: goal.ratio ?? null,
  };
}

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
    return rows.map(rowToEntry);
  }

  async upsertGoal(program: string, goal: StrengthGoalEntry): Promise<StrengthGoalEntry> {
    const row = await this.prisma.strengthGoal.upsert({
      where: { userId_program_lift: { userId: this.userId, program, lift: goal.lift } },
      update: entryToData(goal),
      create: { userId: this.userId, program, lift: goal.lift, ...entryToData(goal) },
    });
    return rowToEntry(row);
  }

  async importGoals(
    program: string,
    goals: StrengthGoalEntry[],
  ): Promise<ImportWriteResult> {
    // One transaction for the whole batch (issue #488): replaces the controller's
    // unwrapped per-row upsert loop, so a mid-batch failure rolls back instead of
    // leaving a partial commit. Counts come from the write, not a separate pre-read.
    // runInteractive reuses the per-request RLS transaction when present, opens one
    // otherwise (with a batch-sized timeout — IMPORT_BATCH_TX_OPTIONS, #532).
    return runInteractive(
      this.prisma,
      async (tx) => {
        const existing = await tx.strengthGoal.findMany({
          where: { userId: this.userId, program },
        });
        const existingByLift = new Map(existing.map((r) => [r.lift, rowToEntry(r)]));

        // Shared classify/dedupe/tally loop (#532); decision is strengthGoalRowKind.
        return classifyAndCount(
          goals,
          (g) => g.lift,
          (g) => strengthGoalRowKind(g, existingByLift),
          (g) =>
            tx.strengthGoal.upsert({
              where: { userId_program_lift: { userId: this.userId, program, lift: g.lift } },
              update: entryToData(g),
              create: { userId: this.userId, program, lift: g.lift, ...entryToData(g) },
            }),
        );
      },
      IMPORT_BATCH_TX_OPTIONS,
    );
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
