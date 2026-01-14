import { jest } from '@jest/globals';

// Mock the repositories
const mockBusinessHoursRepo = {
    getDefaultHours: jest.fn(),
    updateDefaultHours: jest.fn()
};

const mockSpecialHoursRepo = {
    getSpecialHours: jest.fn(),
    updateSpecialHours: jest.fn(),
    getAllStoreSpecialHours: jest.fn()
};

jest.unstable_mockModule('../src/repositories/BusinessHoursRepository.js', () => ({
    default: mockBusinessHoursRepo
}));

jest.unstable_mockModule('../src/repositories/SpecialHoursRepository.js', () => ({
    default: mockSpecialHoursRepo
}));

describe('BusinessHoursService', () => {
    let BusinessHoursService;
    const storeId = 'test_store_123';

    beforeAll(async () => {
        const module = await import('../src/services/BusinessHoursService.js');
        BusinessHoursService = module.default;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should return default hours when no special hours exist', async () => {
        const weeklyHours = [
            { day_of_week: 1, open_time: '09:00', close_time: '17:00', is_closed: false }
        ];

        // Mock repository responses
        mockBusinessHoursRepo.getDefaultHours.mockResolvedValue(weeklyHours);
        mockBusinessHoursRepo.updateDefaultHours.mockResolvedValue(true);
        mockSpecialHoursRepo.getSpecialHours.mockResolvedValue(null); // No special hours

        const result = await BusinessHoursService.getEffectiveHours(storeId, '2026-01-12'); // Mon

        expect(result.type).toBe('default');
        expect(result.open_time).toBe('09:00');
        expect(result.close_time).toBe('17:00');
    });

    test('should return special hours as override', async () => {
        const date = '2026-12-25';
        const specialHours = {
            is_closed: true,
            reason: 'Christmas'
        };

        mockSpecialHoursRepo.getSpecialHours.mockResolvedValue(specialHours);

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

        // Service validation happens before repo call, so repo might not be called.
        // But if it were called, we'd mock it.
        mockSpecialHoursRepo.updateSpecialHours.mockResolvedValue(true);

        await expect(
            BusinessHoursService.updateSpecialHours(storeId, '2026-01-01', invalidHours)
        ).rejects.toThrow('must be before close time');
    });

    test('should return closed status if no default or special hours found', async () => {
        mockSpecialHoursRepo.getSpecialHours.mockResolvedValue(null);
        mockBusinessHoursRepo.getDefaultHours.mockResolvedValue([]); // No defaults

        const result = await BusinessHoursService.getEffectiveHours('unknown_store', '2026-01-01');
        expect(result.is_closed).toBe(true);
        expect(result.type).toBe('missing_default');
    });
});
