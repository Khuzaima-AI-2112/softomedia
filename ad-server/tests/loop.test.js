/**
 * Loop Repository Tests
 * TDD: Write tests first, then implement
 * Business Hours: 8am-10pm (14 loops/day)
 */
import { jest } from '@jest/globals';

// Mock the firestore utility
jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null)
}));

const { LoopRepository, BUSINESS_HOURS } = await import('../src/repositories/LoopRepository.js');

describe('LoopRepository', () => {
    let repo;

    beforeEach(() => {
        repo = new LoopRepository();
    });

    describe('BUSINESS_HOURS constant', () => {
        test('should define start hour as 0', () => {
            expect(BUSINESS_HOURS.START).toBe(0);
        });

        test('should define end hour as 24', () => {
            expect(BUSINESS_HOURS.END).toBe(24);
        });

        test('should calculate 24 loops per day', () => {
            expect(BUSINESS_HOURS.END - BUSINESS_HOURS.START).toBe(24);
        });
    });

    describe('create', () => {
        test('should create a loop with 12 slots', async () => {
            const slots = Array.from({ length: 12 }, (_, i) => ({
                position: i,
                asset_id: `asset_${i}`,
                duration: 5
            }));

            const loop = await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                location_id: 'loc_downtown',
                slots
            });

            expect(loop.id).toBe('2026-01-03_14');
            expect(loop.slots).toHaveLength(12);
        });

        // Nobody approves an Hourly Loop (ADR 0007), so a loop carries no approval state.
        test('records no approval state', async () => {
            const loop = await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                slots: []
            });

            expect(loop).not.toHaveProperty('status');
            expect(loop).not.toHaveProperty('approved_at');
            expect(loop).not.toHaveProperty('approved_by');
        });

        test('should reject loops with invalid hours', async () => {
            await expect(repo.create('2026-01-03_-1', {
                date: '2026-01-03',
                hour: -1, // Invalid
                retailer_id: 'ret_001',
                slots: []
            })).rejects.toThrow();

            await expect(repo.create('2026-01-03_24', {
                date: '2026-01-03',
                hour: 24, // Invalid (0-23)
                retailer_id: 'ret_001',
                slots: []
            })).rejects.toThrow();
        });
    });

    describe('findByDateAndHour', () => {
        test('should find loop by date and hour', async () => {
            await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                slots: []
            });

            const loop = await repo.findByDateAndHour('2026-01-03', 14);
            expect(loop).not.toBeNull();
            expect(loop.hour).toBe(14);
        });
    });

    describe('replaceSlot', () => {
        test('should replace a slot with a new asset in the loop that plays', async () => {
            const slots = Array.from({ length: 12 }, (_, i) => ({
                position: i,
                asset_id: `asset_${i}`,
                duration: 5
            }));

            // A loop approved before #70 is corrected in place too, not cloned into a draft.
            await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                status: 'approved',
                slots
            });

            const updated = await repo.replaceSlot('2026-01-03_14', 3, 'new_asset_xyz');
            expect(updated.id).toBe('2026-01-03_14');
            expect(updated.slots[3].asset_id).toBe('new_asset_xyz');
            expect(updated.slots[3].status).toMatch(/replaced/i); // SLOT_STATUS.REPLACED === 'replaced'
        });
    });
});
