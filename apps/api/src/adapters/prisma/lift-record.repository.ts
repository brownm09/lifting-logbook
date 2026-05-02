import { PrismaClient } from '@prisma/client';
import { LiftRecord } from '@lifting-logbook/core';
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

  async appendLiftRecords(program: string, records: LiftRecord[]): Promise<void> {
    await this.prisma.liftRecord.createMany({
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
  }

  async updateLiftRecord(
    program: string,
    id: string,
    updates: Partial<Pick<LiftRecord, 'weight' | 'reps' | 'notes'>>,
  ): Promise<LiftRecord | null> {
    const parsed = parseLiftRecordId(program, id);
    if (!parsed) return null;

    const existing = await this.prisma.liftRecord.findUnique({
      where: {
        userId_program_cycleNum_workoutNum_lift_setNum: {
          userId: this.userId,
          program,
          ...parsed,
        },
      },
    });
    if (!existing) return null;

    const updated = await this.prisma.liftRecord.update({
      where: { id: existing.id },
      data: {
        ...(updates.weight !== undefined && { weight: updates.weight }),
        ...(updates.reps !== undefined && { reps: updates.reps }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
      },
    });
    return rowToLiftRecord(updated);
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

function rowToLiftRecord(row: {
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
