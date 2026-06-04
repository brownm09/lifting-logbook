import { PrismaClient } from '@prisma/client';
import { HybridLiftingProgramSpecRepository } from './hybrid-program-spec.repository';

const CUSTOM_PROGRAM_ID = '11111111-1111-4111-8111-111111111111';

function makePrisma(): PrismaClient {
  return {
    customProgramSpec: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaClient;
}

describe('HybridLiftingProgramSpecRepository', () => {
  it('routes built-in (non-UUID) program names to the in-memory adapter', async () => {
    const prisma = makePrisma();
    const repo = new HybridLiftingProgramSpecRepository(prisma, 'user-1');

    const spec = await repo.getProgramSpec('5-3-1');

    // In-memory built-in program resolves without touching the DB.
    expect(spec.length).toBeGreaterThan(0);
    expect(prisma.customProgramSpec.findMany).not.toHaveBeenCalled();
  });

  it('scopes custom-program lookups to the requesting user (isolation guard)', async () => {
    const prisma = makePrisma();
    const repo = new HybridLiftingProgramSpecRepository(prisma, 'user-1');

    await repo.getProgramSpec(CUSTOM_PROGRAM_ID);

    expect(prisma.customProgramSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: CUSTOM_PROGRAM_ID, program: { userId: 'user-1' } },
      }),
    );
  });

  it("returns [] when another user's id yields no owned rows", async () => {
    const prisma = makePrisma();
    // findMany already resolves to [] for a non-owner because of the userId guard.
    const repo = new HybridLiftingProgramSpecRepository(prisma, 'attacker');

    const spec = await repo.getProgramSpec(CUSTOM_PROGRAM_ID);

    expect(spec).toEqual([]);
    expect(prisma.customProgramSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: CUSTOM_PROGRAM_ID, program: { userId: 'attacker' } },
      }),
    );
  });
});
