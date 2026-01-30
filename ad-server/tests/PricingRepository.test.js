import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// === MOCK FUNCTION REFERENCES (for per-test control) ===
const mockDocGet = jest.fn();
const mockDocCreate = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocSet = jest.fn();

// Firestore mock structure: db.collection(name).doc(id).get()/create()/update()
const mockDoc = {
    get: mockDocGet,
    create: mockDocCreate,
    update: mockDocUpdate,
    set: mockDocSet
};

const mockCollection = {
    doc: jest.fn(() => mockDoc)
};

const mockFirestore = {
    collection: jest.fn(() => mockCollection)
};

// === ESM MOCKING: jest.unstable_mockModule() MUST come BEFORE imports ===

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => mockFirestore)
}));

// Mock logger to suppress output during tests
jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// === DYNAMIC IMPORTS (AFTER all mocks are registered) ===
const { PricingRepositoryClass } = await import('../src/repositories/PricingRepository.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');

describe('PricingRepository', () => {
    let repo;

    // Helper to setup mock Firestore response
    const setupMock = (docExists, data) => {
        mockDocGet.mockResolvedValue({
            exists: docExists,
            id: 'global',
            data: () => data
        });
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Re-setup mock chain (clearAllMocks resets implementations)
        mockFirestore.collection.mockReturnValue(mockCollection);
        mockCollection.doc.mockReturnValue(mockDoc);

        // Default mock resolutions
        mockDocCreate.mockResolvedValue({});
        mockDocUpdate.mockResolvedValue({});
        mockDocSet.mockResolvedValue({});

        // Clear in-memory storage
        clearMockStorage();

        // Create fresh repository instance
        repo = new PricingRepositoryClass();
    });

    describe('getConfig', () => {
        test('should return default config if none exists', async () => {
            // Setup: document doesn't exist
            setupMock(false, null);

            const config = await repo.getConfig();

            // Verify default values are returned
            expect(config.baseCPM).toBe(15.00);
            expect(config.currency).toBe('USD');
            expect(config.slotDuration).toBe(5);
            expect(config.slotsPerLoop).toBe(12);

            // Verify create was attempted (to initialize defaults)
            expect(mockDocCreate).toHaveBeenCalled();
        });

        test('should return normalized config if exists', async () => {
            // Setup: document exists with snake_case keys
            setupMock(true, {
                base_cpm: 20.00,
                traffic_tiers: {
                    high: { multiplier: 2.0, hours: [12, 13] }
                }
            });

            const config = await repo.getConfig();

            // Verify normalization to camelCase
            expect(config.baseCPM).toBe(20.00);
            expect(config.trafficTiers.high.multiplier).toBe(2.0);
        });

        test('should merge defaults for missing fields', async () => {
            // Setup: document exists but missing some fields
            setupMock(true, {
                baseCPM: 25.00
                // Missing: trafficTiers, dateOverrides, etc.
            });

            const config = await repo.getConfig();

            expect(config.baseCPM).toBe(25.00);
            // Should have default trafficTiers
            expect(config.trafficTiers).toBeDefined();
            expect(config.trafficTiers.low).toBeDefined();
        });
    });

    describe('updateConfig', () => {
        test('should update config and normalize snake_case keys', async () => {
            // Setup: existing config
            setupMock(true, { baseCPM: 15.00, trafficTiers: {} });

            // Update with snake_case key
            const result = await repo.updateConfig({ base_cpm: 25.00 });

            // Verify result has camelCase
            expect(result.baseCPM).toBe(25.00);

            // Verify update was called
            expect(mockDocUpdate).toHaveBeenCalled();

            // Verify the data passed to update uses camelCase
            const updateCall = mockDocUpdate.mock.calls[0][0];
            expect(updateCall.baseCPM).toBe(25.00);
            expect(updateCall.base_cpm).toBeUndefined();
        });

        test('should clear retailerOverrides if baseCPM changes', async () => {
            // Setup: existing config with retailerOverrides
            setupMock(true, {
                baseCPM: 15.00,
                trafficTiers: {},
                retailerOverrides: { 'retailer_1': { baseCPM: 18.00 } }
            });

            // Update baseCPM with clearOverrides=true (default)
            await repo.updateConfig({ baseCPM: 20.00 }, true);

            // Verify update was called with empty retailerOverrides
            expect(mockDocUpdate).toHaveBeenCalled();
            const updateCall = mockDocUpdate.mock.calls[0][0];
            expect(updateCall.retailerOverrides).toEqual({});
        });

        test('should preserve retailerOverrides if baseCPM unchanged', async () => {
            // Setup: existing config with retailerOverrides
            setupMock(true, {
                baseCPM: 15.00,
                trafficTiers: {},
                retailerOverrides: { 'retailer_1': { baseCPM: 18.00 } }
            });

            // Update something else, keeping baseCPM the same
            await repo.updateConfig({ currency: 'EUR' });

            // Verify retailerOverrides preserved
            const updateCall = mockDocUpdate.mock.calls[0][0];
            expect(updateCall.retailerOverrides).toEqual({ 'retailer_1': { baseCPM: 18.00 } });
        });

        test('should not clear retailerOverrides if flag is false', async () => {
            setupMock(true, {
                baseCPM: 15.00,
                trafficTiers: {},
                retailerOverrides: { 'retailer_1': { baseCPM: 18.00 } }
            });

            // Update baseCPM but with clearOverrides=false
            await repo.updateConfig({ baseCPM: 20.00 }, false);

            const updateCall = mockDocUpdate.mock.calls[0][0];
            expect(updateCall.retailerOverrides).toEqual({ 'retailer_1': { baseCPM: 18.00 } });
        });
    });

    describe('calculateSlotPrice', () => {
        test('should calculate price based on traffic tier', async () => {
            setupMock(true, {
                baseCPM: 10.00,
                trafficTiers: {
                    high: { multiplier: 1.5, hours: [12, 13] },
                    medium: { multiplier: 1.0, hours: [14, 15] },
                    low: { multiplier: 0.7, hours: [8, 9] }
                },
                dateOverrides: {}
            });

            const result = await repo.calculateSlotPrice(12);

            expect(result.price).toBe(15.00); // 10 * 1.5
            expect(result.tier).toBe('high');
            expect(result.trafficMultiplier).toBe(1.5);
        });

        test('should apply date overrides', async () => {
            setupMock(true, {
                baseCPM: 10.00,
                trafficTiers: {
                    medium: { multiplier: 1.0, hours: [12] }
                },
                dateOverrides: {
                    '2026-01-01': { multiplier: 2.0 }
                }
            });

            const result = await repo.calculateSlotPrice(12, '2026-01-01');

            expect(result.price).toBe(20.00); // 10 * 1.0 * 2.0
            expect(result.dateMultiplier).toBe(2.0);
        });

        test('should use hourly tier override from dateOverrides', async () => {
            setupMock(true, {
                baseCPM: 10.00,
                trafficTiers: {
                    high: { multiplier: 1.5, hours: [] },
                    medium: { multiplier: 1.0, hours: [12] }
                },
                dateOverrides: {
                    '2026-01-01': {
                        multiplier: 1.0,
                        hourlyTiers: { '12': 'high' } // Override hour 12 to high tier
                    }
                }
            });

            const result = await repo.calculateSlotPrice(12, '2026-01-01');

            expect(result.tier).toBe('high');
            expect(result.price).toBe(15.00); // 10 * 1.5 * 1.0
        });

        test('should fall back to medium tier if hour not found', async () => {
            setupMock(true, {
                baseCPM: 10.00,
                trafficTiers: {
                    high: { multiplier: 1.5, hours: [12] },
                    medium: { multiplier: 1.0, hours: [] }
                },
                dateOverrides: {}
            });

            // Hour 20 not in any tier
            const result = await repo.calculateSlotPrice(20);

            expect(result.tier).toBe('medium');
            expect(result.price).toBe(10.00); // 10 * 1.0
        });
    });

    describe('Schema Parity', () => {
        test('should handle both snake_case and camelCase inputs', async () => {
            setupMock(true, { baseCPM: 15.00, trafficTiers: {} });

            // Both should work and produce same result
            const result1 = await repo.updateConfig({ baseCPM: 20.00 });
            setupMock(true, { baseCPM: 15.00, trafficTiers: {} });
            const result2 = await repo.updateConfig({ base_cpm: 20.00 });

            expect(result1.baseCPM).toBe(20.00);
            expect(result2.baseCPM).toBe(20.00);
        });

        test('should always output camelCase keys', async () => {
            setupMock(true, {
                base_cpm: 25.00,
                traffic_tiers: { high: { multiplier: 1.5, hours: [12] } },
                date_overrides: { '2026-01-01': { multiplier: 2.0 } }
            });

            const config = await repo.getConfig();

            // All keys should be camelCase
            expect(config.baseCPM).toBe(25.00);
            expect(config.trafficTiers).toBeDefined();
            expect(config.dateOverrides).toBeDefined();

            // snake_case should not exist
            expect(config.base_cpm).toBeUndefined();
            expect(config.traffic_tiers).toBeUndefined();
            expect(config.date_overrides).toBeUndefined();
        });
    });
});
