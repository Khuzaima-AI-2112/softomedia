import { jest, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const {
    campaignRepository,
    impressionRepository,
    loopRepository,
    playbackObservationRepository,
    StoreRepository,
} = await import('../src/repositories/index.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');
const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

const DATE = '2030-01-16';
const EMPTY = { breakfast: 0, lunch: 0, dinner: 0, outside_dayparts: 0 };

// Retailer One's Store plays Brand One's Campaign and its own promotion;
// Retailer Two's Store plays Brand One's and Brand Two's Campaigns.
async function seed() {
    await StoreRepository.create('store-one', { name: 'Retailer One Downtown', retailer_id: 'retailer-one' });
    await StoreRepository.create('store-two', { name: 'Retailer Two Uptown', retailer_id: 'retailer-two' });
    await campaignRepository.create('brand-one-cola', { name: 'Cola summer', brand_id: 'brand-one', budget: 900 });
    await campaignRepository.create('brand-two-chips', { name: 'Chips launch', advertiser_id: 'brand-two' });
    await campaignRepository.create('retailer-one-muffin', {
        name: 'Breakfast muffin', type: 'retailer', retailer_id: 'retailer-one',
    });
    for (const [id, retailerId, storeId, hour] of [
        ['one-08', 'retailer-one', 'store-one', 8],
        ['one-12', 'retailer-one', 'store-one', 12],
        ['one-16', 'retailer-one', 'store-one', 16],
        ['two-18', 'retailer-two', 'store-two', 18],
    ]) {
        await loopRepository.create(id, {
            retailer_id: retailerId, store_id: storeId, date: DATE, hour, status: 'approved',
        });
    }
    const proofs = [
        ['brand-one-cola', 'one-08'],
        ['brand-one-cola', 'one-08'],
        ['brand-one-cola', 'one-12'],
        ['brand-one-cola', 'one-16'],
        ['brand-one-cola', 'two-18'],
        ['brand-two-chips', 'two-18'],
        ['retailer-one-muffin', 'one-08'],
    ];
    for (const [index, [campaignId, loopId]] of proofs.entries()) {
        await impressionRepository.create(`pop-${index}`, impressionRepository.buildProofOfPlay({
            event_id: `pop-${index}`, campaign_id: campaignId, loop_id: loopId, slot_position: index,
            presentation_started_at: `${DATE}T12:00:00.000Z`,
        }));
    }
    // Fallback Content playback is reported separately and never counts.
    await playbackObservationRepository.create('fallback-observation', {
        presentation_type: 'fallback', loop_id: 'one-08', slot_position: 11,
    });
    await impressionRepository.create('fallback-record', {
        playback_kind: 'fallback', campaign_id: 'brand-one-cola', loop_id: 'one-08', is_fallback: true,
    });
}

const rowsOf = body => body.rows.map(row => ({ campaign_id: row.campaign_id, ...row.dayparts, total: row.total }));

describeWithAuthEmulator('Daypart delivery report', () => {
    beforeEach(async () => {
        clearMockStorage();
        await seed();
    });

    const get = async (role, organizationId) => request(app)
        .get('/api/delivery-report')
        .set((await signInAs(role, { organizationId })).headers);

    test.each(['superadmin', 'admin'])('shows a %s the whole network, by Campaign and Daypart', async role => {
        const response = await get(role);

        expect(response.status).toBe(200);
        expect(rowsOf(response.body)).toEqual([
            { campaign_id: 'retailer-one-muffin', ...EMPTY, breakfast: 1, total: 1 },
            { campaign_id: 'brand-two-chips', ...EMPTY, dinner: 1, total: 1 },
            { campaign_id: 'brand-one-cola', breakfast: 2, lunch: 1, dinner: 1, outside_dayparts: 1, total: 5 },
        ]);
        expect(response.body.totals).toEqual({ breakfast: 3, lunch: 1, dinner: 2, outside_dayparts: 1, total: 7 });
        expect(response.body.dayparts).toEqual({
            breakfast: { start: 6, end: 11 }, lunch: { start: 11, end: 15 }, dinner: { start: 17, end: 21 },
        });
    });

    test('shows a Brand its own Campaigns in every Store, and no other Brand\'s', async () => {
        const brandOne = await get('brand', 'brand-one');
        const brandTwo = await get('brand', 'brand-two');

        expect(rowsOf(brandOne.body)).toEqual([
            { campaign_id: 'brand-one-cola', breakfast: 2, lunch: 1, dinner: 1, outside_dayparts: 1, total: 5 },
        ]);
        expect(rowsOf(brandTwo.body)).toEqual([
            { campaign_id: 'brand-two-chips', ...EMPTY, dinner: 1, total: 1 },
        ]);
    });

    test('shows a Retailer Administrator delivery in its own Stores only, including Brands\' Campaigns', async () => {
        const retailerOne = await get('retaileradmin', 'retailer-one');
        const retailerTwo = await get('retaileradmin', 'retailer-two');

        expect(rowsOf(retailerOne.body)).toEqual([
            { campaign_id: 'retailer-one-muffin', ...EMPTY, breakfast: 1, total: 1 },
            { campaign_id: 'brand-one-cola', breakfast: 2, lunch: 1, dinner: 0, outside_dayparts: 1, total: 4 },
        ]);
        expect(rowsOf(retailerTwo.body)).toEqual([
            { campaign_id: 'brand-two-chips', ...EMPTY, dinner: 1, total: 1 },
            { campaign_id: 'brand-one-cola', ...EMPTY, dinner: 1, total: 1 },
        ]);
    });

    test('shows an organization with no delivery an empty report, not another organization\'s', async () => {
        for (const [role, organizationId] of [['brand', 'brand-three'], ['retaileradmin', 'retailer-three']]) {
            const response = await get(role, organizationId);
            expect({ role, status: response.status, rows: response.body.rows }).toEqual({ role, status: 200, rows: [] });
            expect(response.body.totals.total).toBe(0);
        }
    });

    test.each([
        ['a Brand', 'brand'],
        ['a Retailer Administrator', 'retaileradmin'],
    ])('is refused to %s without an organization', async (_name, role) => {
        const response = await get(role, null);
        expect(response.status).toBe(403);
    });

    test('is refused to a Technical Operator and to anyone not signed in', async () => {
        expect((await get('techoperator', 'ops')).status).toBe(403);
        expect((await request(app).get('/api/delivery-report')).status).toBe(401);
    });
});
