import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: loopsRouter } = await import('../src/api/loops.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { BusinessHoursService } = await import('../src/services/BusinessHoursService.js');
const { campaignRepository } = await import('../src/repositories/CampaignRepository.js');

const app = createTestApp(loopsRouter, '/api/loops');
const auth = { Authorization: 'Bearer demo-token', 'x-demo-role': 'admin' };

describe('POST /api/loops/generate Allocation Window', () => {
    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({
            now: new Date('2030-01-01T12:00:00.000Z'),
            doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'],
        });
        jest.spyOn(BusinessHoursService, 'getEffectiveHours').mockResolvedValue({
            is_closed: false,
            open_time: '08:00',
            close_time: '13:00',
        });
        for (const category of ['paid', 'retailer', 'internal']) {
            await campaignRepository.create(`${category}-campaign`, {
                type: category,
                asset_id: `${category}-asset`,
                status: 'approved',
                retailer_id: 'retailer-1',
                location_id: 'store-1',
                start_date: '2030-01-01',
                end_date: '2030-01-31',
            });
        }
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('persists and deterministically regenerates an exact five-loop window', async () => {
        const body = {
            targetDate: '2030-01-05',
            retailerId: 'retailer-1',
            locationId: 'store-1',
        };
        const first = await request(app).post('/api/loops/generate').set(auth).send(body);

        expect(first.status).toBe(201);
        expect(first.body.business_hours).toEqual({ start: 8, end: 13, is_closed: false, total_loops: 5 });
        expect(first.body.loops).toHaveLength(5);
        const firstSlots = first.body.loops.flatMap(loop => loop.slots);
        expect(firstSlots.reduce((counts, slot) => ({
            ...counts,
            [slot.allocated_category]: (counts[slot.allocated_category] || 0) + 1,
        }), {})).toEqual({ paid: 42, retailer: 12, internal: 6 });
        expect(first.body.loops.every(loop =>
            loop.slots.length === 12
            && loop.slots.reduce((seconds, slot) => seconds + slot.duration, 0) === 60
        )).toBe(true);

        const persisted = await request(app)
            .get('/api/loops?date=2030-01-05&location_id=store-1')
            .set(auth);
        expect(persisted.body.loops.flatMap(loop => loop.slots)).toEqual(firstSlots);

        const regenerated = await request(app).post('/api/loops/generate').set(auth).send(body);
        expect(regenerated.body.loops.flatMap(loop => loop.slots)).toEqual(firstSlots);
    });
});
