import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ILiftingProgramSpecRepository } from '../ports/ILiftingProgramSpecRepository';
import { IWorkoutDateOverrideRepository } from '../ports/IWorkoutDateOverrideRepository';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { RescheduleController } from './reschedule.controller';

const MOCK_USER_A = { id: 'user-a', email: 'a@example.com', provider: 'dev' };
const _MOCK_USER_B = { id: 'user-b', email: 'b@example.com', provider: 'dev' };

const STUB_SPEC = [{ lift: 'Squat' }] as unknown as Awaited<ReturnType<ILiftingProgramSpecRepository['getProgramSpec']>>;

describe('RescheduleController', () => {
  let controller: RescheduleController;
  let overrideRepoA: jest.Mocked<IWorkoutDateOverrideRepository>;
  let overrideRepoB: jest.Mocked<IWorkoutDateOverrideRepository>;
  let specRepoA: jest.Mocked<ILiftingProgramSpecRepository>;
  let specRepoB: jest.Mocked<ILiftingProgramSpecRepository>;
  let factory: jest.Mocked<IRepositoryFactory>;

  beforeEach(async () => {
    overrideRepoA = {
      getOverride: jest.fn().mockResolvedValue(null),
      upsertOverride: jest.fn().mockResolvedValue(undefined),
    };
    overrideRepoB = {
      getOverride: jest.fn().mockResolvedValue(null),
      upsertOverride: jest.fn().mockResolvedValue(undefined),
    };
    specRepoA = { getProgramSpec: jest.fn().mockResolvedValue(STUB_SPEC) } as jest.Mocked<ILiftingProgramSpecRepository>;
    specRepoB = { getProgramSpec: jest.fn().mockResolvedValue(STUB_SPEC) } as jest.Mocked<ILiftingProgramSpecRepository>;
    factory = {
      forUser: jest.fn().mockImplementation(async (user) =>
        user.id === MOCK_USER_A.id
          ? { workoutDateOverride: overrideRepoA, liftingProgramSpec: specRepoA }
          : { workoutDateOverride: overrideRepoB, liftingProgramSpec: specRepoB },
      ),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RescheduleController],
      providers: [{ provide: REPOSITORY_FACTORY, useValue: factory }],
    }).compile();
    controller = module.get(RescheduleController);
  });

  it('upserts an override for valid inputs', async () => {
    await controller.reschedule('5-3-1', '3', '2', { newDate: '2026-05-15' }, MOCK_USER_A);

    expect(overrideRepoA.upsertOverride).toHaveBeenCalledWith(
      '5-3-1',
      3,
      2,
      new Date('2026-05-15T00:00:00Z'),
    );
  });

  it('returns no content (void) on success', async () => {
    const result = await controller.reschedule(
      '5-3-1',
      '3',
      '2',
      { newDate: '2026-05-15' },
      MOCK_USER_A,
    );
    expect(result).toBeUndefined();
  });

  it('rejects non-integer cycleNum', async () => {
    await expect(
      controller.reschedule('5-3-1', 'abc', '2', { newDate: '2026-05-15' }, MOCK_USER_A),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(overrideRepoA.upsertOverride).not.toHaveBeenCalled();
  });

  it('rejects zero cycleNum', async () => {
    await expect(
      controller.reschedule('5-3-1', '0', '2', { newDate: '2026-05-15' }, MOCK_USER_A),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-integer workoutNum', async () => {
    await expect(
      controller.reschedule('5-3-1', '3', 'xyz', { newDate: '2026-05-15' }, MOCK_USER_A),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects workoutNum less than 1', async () => {
    await expect(
      controller.reschedule('5-3-1', '3', '0', { newDate: '2026-05-15' }, MOCK_USER_A),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('user A reschedule does not affect user B repo', async () => {
    await controller.reschedule('5-3-1', '3', '2', { newDate: '2026-05-15' }, MOCK_USER_A);

    expect(overrideRepoA.upsertOverride).toHaveBeenCalledTimes(1);
    expect(overrideRepoB.upsertOverride).not.toHaveBeenCalled();
  });

  it('rejects unknown program with NotFoundException', async () => {
    specRepoA.getProgramSpec.mockResolvedValue([]);
    await expect(
      controller.reschedule('no-such-program', '3', '2', { newDate: '2026-05-15' }, MOCK_USER_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(overrideRepoA.upsertOverride).not.toHaveBeenCalled();
  });
});
