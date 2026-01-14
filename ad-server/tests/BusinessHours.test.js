import { jest } from '@jest/globals';
import BusinessHoursService from '../../src/services/BusinessHoursService.js';
import BusinessHoursRepository from '../../src/repositories/BusinessHoursRepository.js';
import SpecialHoursRepository from '../../src/repositories/SpecialHoursRepository.js';

describe('BusinessHoursService', () => {
    const storeId = 'test_store_123';

    beforeEach(async () => {
        // Clear mock storage via repositories if possible, 
        // but since we're using the real ones with MOCK_STORAGE fallback, 
        // we'll rely on unique IDs or cleanup if BaseRepository supported it.
        // For these tests, we'll just use the service directly.
    });

    test('should return default hours when no special hours exist', async () => {
        const weeklyHours = [
            { day_of_week: 1, open_time: '09:00', close_time: '17:00', is_closed: false }
        ];
        await BusinessHoursService.updateWeeklyHours(storeId, weeklyHours);

        // 2026-01-12 is a Monday (day 1)
        const result = await BusinessHoursService.getEffectiveHours(storeId, '2026-01-12');

        expect(result.type).toBe('default');
        expect(result.open_time).toBe('09:00');
        expect(result.close_time).toBe('17:00');
    });

    test('should return special hours as override', async () => {
        const date = '2026-12-25';
        await BusinessHoursService.updateSpecialHours(storeId, date, {
            is_closed: true,
            reason: 'Christmas'
        });

        const result = await BusinessHoursService.getEffectiveHours(storeId, date);

        expect(result.type).toBe('special');
        expect(result.is_closed).toBe(true);
        expect(result.reason).toBe('Christmas');
    });

    test('should validate that open_time < close_time', async () => {
        const invalidHours = {
            open_time: '17:00',
            close_time: '09:00',
            is_closed: false
        };

        await expect(
            BusinessHoursService.updateSpecialHours(storeId, '2026-01-01', invalidHours)
        ).rejects.toThrow('must be before close time');
    });

    test('should return closed status if no default or special hours found', async () => {
        const result = await BusinessHoursService.getEffectiveHours('unknown_store', '2026-01-01');
        expect(result.is_closed).toBe(true);
        expect(result.type).toBe('missing_default');
    });
});
