import { PrismaClient } from '@prisma/client';
// Prisma 5.x — error classes moved off the Prisma namespace
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { LiftRecord, liftRecordNaturalKey, parseLiftRecordNaturalKey } from '@lifting-logbook/core';
import { ILiftRecordRepository } from '../../ports/ILiftRecordRepository';

export class PrismaLiftRecordRepository implements ILiftRecordRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userId: string,
  ) {}

  async getLiftRecords(program: string, cycleNum: number): Promise<LiftRecord[]> {
    const rows = await this.prisma.liftRecord.findMany({
      where: { userId: this.userId, program, cycleNum },
    });
    return rows.map(rowToLiftRecord);
  }

  async appendLiftRecords(program: string, records: LiftRecord[]): Promise<number> {
    const { count } = await this.prisma.liftRecord.createMany({
      data: records.map((r) => ({
        userId: this.userId,
        program,
        cycleNum: r.cycleNum,
        workoutNum: r.workoutNum,
        date: r.date,
        lift: r.lift,
        setNum: r.setNum,
        weight: r.weight,
        reps: r.reps,
        notes: r.notes,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  async findExistingRecords(program: string, candidates: LiftRecord[]): Promise<LiftRecord[]> {
    if (candidates.length === 0) return [];

    // Chunk the OR array to stay within Postgres parameter limits (~32k).
    // Each candidate produces 4 bound parameters; 500 chunks ≈ 2000 params per query.
    const CHUNK_SIZE = 500;
    const chunks: LiftRecord[][] = [];
    for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
      chunks.push(candidates.slice(i, i + CHUNK_SIZE));
    }

    const rowGroups = await Promise.all(
      chunks.map((chunk) =>
        this.prisma.liftRecord.findMany({
          where: {
            userId: this.userId,
            program,
            OR: chunk.map((r) => ({
              cycleNum: r.cycleNum,
              workoutNum: r.workoutNum,
              lift: r.lift,
              setNum: r.setNum,
            })),
          },
        }),
      ),
    );

    const existingKeys = new Set(rowGroups.flat().map(liftRecordNaturalKey));
    return candidates.filter((r) => existingKeys.has(liftRecordNaturalKey(r)));
  }

  async updateLiftRecord(
    program: string,
    id: string,
    updates: Partial<Pick<LiftRecord, 'weight' | 'reps' | 'notes'>>,
  ): Promise<LiftRecord | null> {
    const parsed = parseLiftRecordId(program, id);
    if (!parsed) return null;

    try {
      const updated = await this.prisma.liftRecord.update({
        where: {
          userId_program_cycleNum_workoutNum_lift_setNum: {
            userId: this.userId,
            program,
            ...parsed,
          },
        },
        data: {
          ...(updates.weight !== undefined && { weight: updates.weight }),
          ...(updates.reps !== undefined && { reps: updates.reps }),
          ...(updates.notes !== undefined && { notes: updates.notes }),
        },
      });
      return rowToLiftRecord(updated);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        return null;
      }
      throw e;
    }
  }

  async deleteLiftRecordsByNaturalKeys(program: string, naturalKeys: string[]): Promise<number> {
    if (naturalKeys.length === 0) return 0;
    const parsed = naturalKeys.flatMap((k) => {
      const p = parseLiftRecordNaturalKey(k);
      return p ? [p] : [];
    });
    if (parsed.length === 0) return 0;
    const { count } = await this.prisma.liftRecord.deleteMany({
      where: {
        userId: this.userId,
        program,
        OR: parsed.map((p) => ({
          cycleNum: p.cycleNum,
          workoutNum: p.workoutNum,
          lift: p.lift,
          setNum: p.setNum,
        })),
      },
    });
    return count;
  }
}

// ID format: ${program}-${cycleNum}-${workoutNum}-${lift}-${setNum}
// cycleNum, workoutNum, setNum are integers; lift may contain hyphens (e.g. "Chin-up").
function parseLiftRecordId(
  program: string,
  id: string,
): { cycleNum: number; workoutNum: number; lift: string; setNum: number } | null {
  const prefix = `${program}-`;
  if (!id.startsWith(prefix)) return null;
  const rest = id.slice(prefix.length);
  const parts = rest.split('-');
  if (parts.length < 4) return null;

  const cycleNum = parseInt(parts[0] ?? '', 10);
  const workoutNum = parseInt(parts[1] ?? '', 10);
  const setNum = parseInt(parts[parts.length - 1] ?? '', 10);
  const lift = parts.slice(2, parts.length - 1).join('-');

  if (isNaN(cycleNum) || isNaN(workoutNum) || isNaN(setNum) || !lift) return null;
  return { cycleNum, workoutNum, lift, setNum };
}

export function rowToLiftRecord(row: {
  program: string;
  cycleNum: number;
  workoutNum: number;
  date: Date;
  lift: string;
  setNum: number;
  weight: number;
  reps: number;
  notes: string;
}): LiftRecord {
  return {
    program: row.program,
    cycleNum: row.cycleNum,
    workoutNum: row.workoutNum,
    date: row.date,
    lift: row.lift,
    setNum: row.setNum,
    weight: row.weight,
    reps: row.reps,
    notes: row.notes,
  };
}
