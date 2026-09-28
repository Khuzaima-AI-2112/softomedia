import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const schedule = jest.fn();
jest.unstable_mockModule('node-cron', () => ({ default: { schedule } }));
jest.unstable_mockModule('../src/utils/firestore.js', () => ({ getFirestore: jest.fn(() => null) }));

const { initCronJobs } = await import('../src/utils/cron.js');
const { StoreRepository } = await import('../src/repositories/StoreRepository.js');
const { loopGenerationService } = await import('../src/services/LoopGenerationService.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');

/** The job registered for midnight, run as node-cron would run it. */
function midnightJob() {
    initCronJobs();
    expect(schedule).toHaveBeenCalledWith('0 0 * * *', expect.any(Function));
    return schedule.mock.calls.at(-1)[1];
}

describe('Nightly Daily Schedule generation', () => {
    beforeEach(() => {
        clearMockStorage();
        jest.useFakeTimers({ now: new Date('2030-01-07T00:00:00.000Z'), doNotFake: ['nextTick', 'setImmediate'] });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        schedule.mockClear();
    });

    test('generates tomorrow\'s Daily Schedule for every active Store, skipping inactive ones', async () => {
        await StoreRepository.create('open-store', { retailer_id: 'retailer-one', status: 'active' });
        await StoreRepository.create('unassigned-store', { status: 'active' });
        await StoreRepository.create('closed-store', { retailer_id: 'retailer-one', status: 'inactive' });
        const generate = jest.spyOn(loopGenerationService, 'generateDailyLoops').mockResolvedValue([{}, {}]);

        await midnightJob()();

        expect(generate.mock.calls).toEqual([
            ['2030-01-08', 'retailer-one', 'open-store'],
            ['2030-01-08', 'system_unassigned', 'unassigned-store'],
        ]);
    });

    test('one Store failing does not stop the others', async () => {
        await StoreRepository.create('failing-store', { retailer_id: 'retailer-one', status: 'active' });
        await StoreRepository.create('healthy-store', { retailer_id: 'retailer-one', status: 'active' });
        const generate = jest.spyOn(loopGenerationService, 'generateDailyLoops')
            .mockImplementation(async (_date, _retailer, storeId) => {
                if (storeId === 'failing-store') throw new Error('No schedule');
                return undefined;
            });

        await midnightJob()();

        expect(generate).toHaveBeenCalledWith('2030-01-08', 'retailer-one', 'healthy-store');
    });

    test('a failure to read the Stores is logged, not thrown', async () => {
        jest.spyOn(StoreRepository, 'findAll').mockRejectedValue(new Error('Firestore unavailable'));
        const generate = jest.spyOn(loopGenerationService, 'generateDailyLoops');

        await expect(midnightJob()()).resolves.toBeUndefined();
        expect(generate).not.toHaveBeenCalled();
    });
});
