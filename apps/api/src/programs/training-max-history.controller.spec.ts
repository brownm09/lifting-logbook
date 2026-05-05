import { Test, TestingModule } from '@nestjs/testing';
import { ITrainingMaxHistoryRepository } from '../ports/ITrainingMaxHistoryRepository';
import { IRepositoryFactory } from '../ports/factory';
import { REPOSITORY_FACTORY } from '../ports/tokens';
import { TrainingMaxHistoryController } from './training-max-history.controller';
import { HistoryEntryNotFoundError } from '../ports/errors';

const MOCK_USER = { id: 'test-user', email: 'test@example.com', provider: 'dev' };

const ENTRY = {
  id: 'entry-1',
  lift: 'Squat',
  weight: 315,
  reps: 1,
  date: new Date('2026-04-20T00:00:00.000Z'),
  isPR: false,
  source: 'program' as const,
  goalMet: false,
};

describe('TrainingMaxHistoryController', () => {
  let controller: TrainingMaxHistoryController;
  let repo: jest.Mocked<ITrainingMaxHistoryRepository>;
  let factory: jest.Mocked<IRepositoryFactory>;

  beforeEach(async () => {
    repo = {
      getHistory: jest.fn(),
      appendHistoryEntries: jest.fn(),
      updateHistoryEntry: jest.fn(),
    };
    factory = {
      forUser: jest.fn().mockResolvedValue({ trainingMaxHistory: repo }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrainingMaxHistoryController],
      providers: [{ provide: REPOSITORY_FACTORY, useValue: factory }],
    }).compile();
    controller = module.get(TrainingMaxHistoryController);
  });

  describe('getHistory', () => {
    it('returns mapped entries with ISO date and unit', async () => {
      repo.getHistory.mockResolvedValue([ENTRY]);

      const result = await controller.getHistory('5-3-1', undefined, undefined, undefined, MOCK_USER);

      expect(factory.forUser).toHaveBeenCalledWith(MOCK_USER);
      expect(repo.getHistory).toHaveBeenCalledWith('5-3-1', { lift: undefined, source: undefined, isPR: undefined });
      expect(result).toEqual({
        entries: [
          {
            id: 'entry-1',
            lift: 'Squat',
            weight: 315,
            unit: 'lbs',
            date: '2026-04-20',
            isPR: false,
            source: 'program',
            goalMet: false,
          },
        ],
      });
    });

    it('passes lift filter to repository', async () => {
      repo.getHistory.mockResolvedValue([]);

      await controller.getHistory('5-3-1', 'Squat', undefined, undefined, MOCK_USER);

      expect(repo.getHistory).toHaveBeenCalledWith('5-3-1', expect.objectContaining({ lift: 'Squat' }));
    });

    it('parses isPR=true string filter', async () => {
      repo.getHistory.mockResolvedValue([]);

      await controller.getHistory('5-3-1', undefined, undefined, 'true', MOCK_USER);

      expect(repo.getHistory).toHaveBeenCalledWith('5-3-1', expect.objectContaining({ isPR: true }));
    });

    it('parses isPR=false string filter', async () => {
      repo.getHistory.mockResolvedValue([]);

      await controller.getHistory('5-3-1', undefined, undefined, 'false', MOCK_USER);

      expect(repo.getHistory).toHaveBeenCalledWith('5-3-1', expect.objectContaining({ isPR: false }));
    });

    it('passes source filter to repository', async () => {
      repo.getHistory.mockResolvedValue([]);

      await controller.getHistory('5-3-1', undefined, 'test', undefined, MOCK_USER);

      expect(repo.getHistory).toHaveBeenCalledWith('5-3-1', expect.objectContaining({ source: 'test' }));
    });
  });

  describe('updateEntry', () => {
    it('returns mapped updated entry', async () => {
      const updated = { ...ENTRY, isPR: true };
      repo.updateHistoryEntry.mockResolvedValue(updated);

      const result = await controller.updateEntry('5-3-1', 'entry-1', { isPR: true }, MOCK_USER);

      expect(repo.updateHistoryEntry).toHaveBeenCalledWith('5-3-1', 'entry-1', { isPR: true });
      expect(result).toEqual(expect.objectContaining({ id: 'entry-1', isPR: true, unit: 'lbs' }));
    });

    it('propagates HistoryEntryNotFoundError for unknown id', async () => {
      repo.updateHistoryEntry.mockRejectedValue(new HistoryEntryNotFoundError('bad-id'));

      await expect(
        controller.updateEntry('5-3-1', 'bad-id', { isPR: true }, MOCK_USER),
      ).rejects.toBeInstanceOf(HistoryEntryNotFoundError);
    });
  });
});
