import { jest } from '@jest/globals';

// Mock Firestore
const mockFirestore = {
    collection: jest.fn(),
    doc: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn()
};

const mockCollection = {
    doc: jest.fn(() => mockDoc)
};

const mockDoc = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn()
};

mockFirestore.collection.mockReturnValue(mockCollection);

// Mock the utils
jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => mockFirestore)
}));

import { PricingRepository } from '../src/repositories/PricingRepository.js';

describe('PricingRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getConfig', () => {
        test('should return default config if none exists', async () => {
            mockDoc.get.mockResolvedValue({ exists: false });
            mockDoc.set.mockResolvedValue({}); // Simulate creation

            const config = await PricingRepository.getConfig();

            expect(config.baseCPM).toBe(15.00);
            expect(mockDoc.set).toHaveBeenCalled();
        });

        test('should return normalized config if exists', async () => {
            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => ({
                    base_cpm: 20.00,
                    traffic_tiers: {
                        high: { multiplier: 2.0 }
                    }
                })
            });

            const config = await PricingRepository.getConfig();
            expect(config.baseCPM).toBe(20.00);
            expect(config.trafficTiers.high.multiplier).toBe(2.0);
        });
    });

    describe('updateConfig', () => {
        test('should update config and normalize keys', async () => {
            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => ({ baseCPM: 15.00 })
            });

            mockDoc.update.mockResolvedValue({});

            const updates = { base_cpm: 25.00 };
            const result = await PricingRepository.updateConfig(updates);

            expect(result.baseCPM).toBe(25.00);
            expect(mockDoc.update).toHaveBeenCalledWith(
                expect.objectContaining({ baseCPM: 25.00 })
            );
        });

        test('should clear retailerOverrides if baseCPM changes', async () => {
            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => ({ baseCPM: 15.00, retailerOverrides: { 'ret_1': {} } })
            });

            await PricingRepository.updateConfig({ baseCPM: 20.00 }, true);

            expect(mockDoc.update).toHaveBeenCalledWith(
                expect.objectContaining({ retailerOverrides: {} })
            );
        });
    });

    describe('calculateSlotPrice', () => {
        test('should calculate price based on tier', async () => {
            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => ({
                    baseCPM: 10.00,
                    trafficTiers: {
                        high: { multiplier: 1.5, hours: [12] },
                        medium: { multiplier: 1.0, hours: [13] }
                    },
                    dateOverrides: {}
                })
            });

            const result = await PricingRepository.calculateSlotPrice(12);
            expect(result.price).toBe(15.00); // 10 * 1.5
            expect(result.tier).toBe('high');
        });

        test('should apply date overrides', async () => {
            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => ({
                    baseCPM: 10.00,
                    trafficTiers: { medium: { multiplier: 1.0, hours: [12] } },
                    dateOverrides: {
                        '2026-01-01': { multiplier: 2.0 }
                    }
                })
            });

            const result = await PricingRepository.calculateSlotPrice(12, '2026-01-01');
            expect(result.price).toBe(20.00); // 10 * 1.0 * 2.0
            expect(result.dateMultiplier).toBe(2.0);
        });
    });
});
