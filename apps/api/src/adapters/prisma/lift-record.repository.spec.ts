import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaLiftRecordRepository } from './lift-record.repository';

const BASE_ROW = {
  id: 'row-id-1',
  userId: 'user-1',
  program: '5-3-1',
  cycleNum: 2,
  workoutNum: 3,
  date: new Date('2026-04-01T00:00:00.000Z'),
  lift: 'Bench Press',
  setNum: 1,
  weight: 180,
  reps: 5,
  notes: '',
};

function makePrisma(overrides: Partial<PrismaClient> = {}): PrismaClient {
  return {
    liftRecord: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

describe('PrismaLiftRecordRepository', () => {
  describe('updateLiftRecord — ID parsing and DB dispatch', () => {
    it('updates a record with a plain program name', async () => {
      const prisma = makePrisma();
      (prisma.liftRecord.update as jest.Mock).mockResolvedValue({ ...BASE_ROW, weight: 185 });
      const repo = new PrismaLiftRecordRepository(prisma, 'user-1');

      const result = await repo.updateLiftRecord('5-3-1', '5-3-1-2-3-Bench Press-1', { weight: 185 });

      expect(prisma.liftRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_program_cycleNum_workoutNum_lift_setNum: {
              userId: 'user-1',
              program: '5-3-1',
              cycleNum: 2,
              workoutNum: 3,
              lift: 'Bench Press',
              setNum: 1,
            },
          },
        }),
      );
      expect(result?.weight).toBe(185);
    });

    it('correctly parses a hyphenated lift name (e.g. Chin-up)', async () => {
      const row = { ...BASE_ROW, lift: 'Chin-up', setNum: 2 };
      const prisma = makePrisma();
      (prisma.liftRecord.update as jest.Mock).mockResolvedValue(row);
      const repo = new PrismaLiftRecordRepository(prisma, 'user-1');

      await repo.updateLiftRecord('5-3-1', '5-3-1-2-3-Chin-up-2', { reps: 8 });

      expect(prisma.liftRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_program_cycleNum_workoutNum_lift_setNum: expect.objectContaining({
              lift: 'Chin-up',
              setNum: 2,
            }),
          },
        }),
      );
    });

    it('correctly parses a multi-word hyphenated lift name (e.g. Romanian Dead-lift)', async () => {
      const row = { ...BASE_ROW, lift: 'Romanian Dead-lift', setNum: 3 };
      const prisma = makePrisma();
      (prisma.liftRecord.update as jest.Mock).mockResolvedValue(row);
      const repo = new PrismaLiftRecordRepository(prisma, 'user-1');

      await repo.updateLiftRecord('5-3-1', '5-3-1-2-3-Romanian Dead-lift-3', { notes: 'light' });

      expect(prisma.liftRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_program_cycleNum_workoutNum_lift_setNum: expect.objectContaining({
              lift: 'Romanian Dead-lift',
              setNum: 3,
            }),
          },
        }),
      );
    });

    it('returns null when the id prefix does not match the program', async () => {
      const prisma = makePrisma();
      const repo = new PrismaLiftRecordRepository(prisma, 'user-1');

      const result = await repo.updateLiftRecord('5-3-1', 'other-program-1-1-Squat-1', { weight: 200 });

      expect(result).toBeNull();
      expect(prisma.liftRecord.update).not.toHaveBeenCalled();
    });

    it('returns null when the record does not exist in the DB (P2025)', async () => {
      const prisma = makePrisma();
      const p2025 = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      (prisma.liftRecord.update as jest.Mock).mockRejectedValue(p2025);
      const repo = new PrismaLiftRecordRepository(prisma, 'user-1');

      const result = await repo.updateLiftRecord('5-3-1', '5-3-1-2-3-Squat-1', { weight: 200 });

      expect(result).toBeNull();
    });

    it('re-throws non-P2025 Prisma errors', async () => {
      const prisma = makePrisma();
      const dbError = new PrismaClientKnownRequestError('Connection error', {
        code: 'P1001',
        clientVersion: '5.0.0',
      });
      (prisma.liftRecord.update as jest.Mock).mockRejectedValue(dbError);
      const repo = new PrismaLiftRecordRepository(prisma, 'user-1');

      await expect(
        repo.updateLiftRecord('5-3-1', '5-3-1-2-3-Squat-1', { weight: 200 }),
      ).rejects.toThrow(dbError);
    });
  });
});
