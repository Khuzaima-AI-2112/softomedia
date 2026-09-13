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
const { mediaRepository } = await import('../src/repositories/MediaRepository.js');

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
                store_id: 'store-1',
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
            storeId: 'store-1',
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
            .get('/api/loops?date=2030-01-05&store_id=store-1')
            .set(auth);
        expect(persisted.body.loops.flatMap(loop => loop.slots)).toEqual(firstSlots);

        const regenerated = await request(app).post('/api/loops/generate').set(auth).send(body);
        expect(regenerated.body.loops.flatMap(loop => loop.slots)).toEqual(firstSlots);
    });

    test('preserves continuity through a closed day and reports deficient-category fallback', async () => {
        clearMockStorage();
        BusinessHoursService.getEffectiveHours.mockImplementation(async (_storeId, date) => {
            if (date === '2030-01-02') return { is_closed: true };
            if (date === '2030-01-01') return { is_closed: false, open_time: '08:00', close_time: '10:00' };
            return { is_closed: false, open_time: '08:00', close_time: '11:00' };
        });
        await campaignRepository.create('local-paid', {
            type: 'paid', asset_id: 'local-paid-asset', status: 'approved',
            inventory_selection: [{ retailer_id: 'retailer-1', store_id: 'store-1' }],
            start_date: '2030-01-01', end_date: '2030-01-31',
        });
        await campaignRepository.create('other-store-paid', {
            type: 'paid', asset_id: 'other-store-asset', status: 'approved',
            inventory_selection: [{ retailer_id: 'retailer-2', store_id: 'store-2' }],
            start_date: '2030-01-01', end_date: '2030-01-31',
        });
        await mediaRepository.create('retailer-media', {
            title: 'Retailer promotion', category: 'retailer', content_kind: 'campaign',
            owner_type: 'retailer', owner_id: 'retailer-1', approval_status: 'approved',
            eligible_for_playback: true, status: 'ready',
        });
        await mediaRepository.create('fallback-media', {
            title: 'Neutral fallback', category: 'fallback', content_kind: 'neutral_fallback',
            owner_type: 'platform', owner_id: null, approval_status: 'approved',
            eligible_for_playback: true, status: 'ready',
        });
        const generate = date => request(app).post('/api/loops/generate').set(auth).send({
            targetDate: date, retailerId: 'retailer-1', storeId: 'store-1',
        });

        const firstDay = await generate('2030-01-01');
        expect(firstDay.status).toBe(201);
        expect(firstDay.body.loops.map(loop => loop.slots[0].allocation_sequence_position)).toEqual([0, 12]);
        const firstSlots = firstDay.body.loops.flatMap(loop => loop.slots);
        expect(firstSlots.some(slot => slot.asset_id === 'other-store-asset')).toBe(false);
        expect(firstSlots.find(slot => slot.allocated_category === 'retailer')).toMatchObject({
            asset_id: 'retailer-media', content_kind: 'campaign', is_fallback: false,
        });
        expect(firstSlots.find(slot => slot.allocated_category === 'internal')).toMatchObject({
            asset_id: 'fallback-media', content_kind: 'fallback', is_fallback: true,
        });

        const closedDay = await generate('2030-01-02');
        expect(closedDay.status).toBe(201);
        expect(closedDay.body.loops).toEqual([]);
        expect(closedDay.body.business_hours).toEqual({
            start: null, end: null, is_closed: true, total_loops: 0,
        });

        const thirdDay = await generate('2030-01-03');
        expect(thirdDay.body.loops.map(loop => loop.slots[0].allocation_sequence_position))
            .toEqual([24, 36, 48]);
    });
});
