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
        test('should define start hour as 8', () => {
            expect(BUSINESS_HOURS.START).toBe(8);
        });

        test('should define end hour as 22', () => {
            expect(BUSINESS_HOURS.END).toBe(22);
        });

        test('should calculate 14 loops per day', () => {
            expect(BUSINESS_HOURS.END - BUSINESS_HOURS.START).toBe(14);
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
                status: 'PENDING_APPROVAL',
                slots
            });

            expect(loop.id).toBe('2026-01-03_14');
            expect(loop.slots).toHaveLength(12);
            expect(loop.status).toBe('PENDING_APPROVAL');
        });

        test('should reject loops outside business hours', async () => {
            await expect(repo.create('2026-01-03_07', {
                date: '2026-01-03',
                hour: 7, // Before 8am
                retailer_id: 'ret_001',
                slots: []
            })).rejects.toThrow('Hour 7 is outside business hours');

            await expect(repo.create('2026-01-03_23', {
                date: '2026-01-03',
                hour: 23, // After 10pm
                retailer_id: 'ret_001',
                slots: []
            })).rejects.toThrow('Hour 23 is outside business hours');
        });
    });

    describe('findByDateAndHour', () => {
        test('should find loop by date and hour', async () => {
            await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                status: 'APPROVED',
                slots: []
            });

            const loop = await repo.findByDateAndHour('2026-01-03', 14);
            expect(loop).not.toBeNull();
            expect(loop.hour).toBe(14);
        });
    });

    describe('findPendingByRetailer', () => {
        test('should return only pending loops for retailer', async () => {
            await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                status: 'PENDING_APPROVAL',
                slots: []
            });

            await repo.create('2026-01-03_15', {
                date: '2026-01-03',
                hour: 15,
                retailer_id: 'ret_001',
                status: 'APPROVED',
                slots: []
            });

            const pending = await repo.findPendingByRetailer('ret_001');
            expect(pending).toHaveLength(1);
            expect(pending[0].status).toBe('PENDING_APPROVAL');
        });
    });

    describe('approveLoop', () => {
        test('should change status to APPROVED', async () => {
            await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                status: 'PENDING_APPROVAL',
                slots: []
            });

            const updated = await repo.approveLoop('2026-01-03_14', 'user_123');
            expect(updated.status).toBe('APPROVED');
            expect(updated.approved_by).toBe('user_123');
            expect(updated.approved_at).toBeDefined();
        });
    });

    describe('rejectSlot', () => {
        test('should mark specific slot as rejected', async () => {
            const slots = Array.from({ length: 12 }, (_, i) => ({
                position: i,
                asset_id: `asset_${i}`,
                duration: 5,
                status: 'PENDING'
            }));

            await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                status: 'PENDING_APPROVAL',
                slots
            });

            const updated = await repo.rejectSlot('2026-01-03_14', 3, 'Competitor ad');
            expect(updated.slots[3].status).toBe('REJECTED');
            expect(updated.slots[3].rejection_reason).toBe('Competitor ad');
        });
    });

    describe('replaceSlot', () => {
        test('should replace rejected slot with new asset', async () => {
            const slots = Array.from({ length: 12 }, (_, i) => ({
                position: i,
                asset_id: `asset_${i}`,
                duration: 5,
                status: i === 3 ? 'REJECTED' : 'PENDING'
            }));

            await repo.create('2026-01-03_14', {
                date: '2026-01-03',
                hour: 14,
                retailer_id: 'ret_001',
                status: 'PENDING_APPROVAL',
                slots
            });

            const updated = await repo.replaceSlot('2026-01-03_14', 3, 'new_asset_xyz');
            expect(updated.slots[3].asset_id).toBe('new_asset_xyz');
            expect(updated.slots[3].status).toBe('REPLACED');
        });
    });
});
