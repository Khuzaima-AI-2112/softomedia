import { jest, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const {
    locationRepository,
    retailerRepository,
    screenRepository,
    StoreRepository,
} = await import('../src/repositories/index.js');
const { default: BusinessHoursRepository } = await import('../src/repositories/BusinessHoursRepository.js');
const { default: SpecialHoursRepository } = await import('../src/repositories/SpecialHoursRepository.js');
const { loopRepository } = await import('../src/repositories/LoopRepository.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');

const app = createTestApp(apiRouter, '/api');

// The first sign-up against a cold Auth emulator can take several seconds.
jest.setTimeout(30_000);

// 2030-01-07 is a Monday; no schedule is ever generated for it here.
const DATE = '2030-01-07';
const MONDAY = 1;

async function seedBookableStore({ storeId = 'store-one', retailerId = 'retailer-one' } = {}) {
    await retailerRepository.create(retailerId, { name: 'Northwind Cafés', status: 'active' });
    await StoreRepository.create(storeId, {
        name: 'Northwind Downtown', retailer_id: retailerId, status: 'active', time_zone: 'America/Toronto',
    });
    await locationRepository.create(`${storeId}-entrance`, {
        name: 'Entrance', store_id: storeId, retailer_id: retailerId, status: 'active',
    });
    await screenRepository.create(`${storeId}-screen`, {
        name: 'Entrance Screen', store_id: storeId, location_id: `${storeId}-entrance`,
        retailer_id: retailerId, status: 'active',
    });
    await BusinessHoursRepository.create(`def_${storeId}_${MONDAY}`, {
        store_id: storeId, day_of_week: MONDAY, is_closed: false, open_time: '08:00', close_time: '22:00',
    });
}

const slotsFor = (headers, storeId = 'store-one', date = DATE) => request(app)
    .get(`/api/inventory/stores/${storeId}/slots?date=${date}`)
    .set(headers);

describeWithAuthEmulator('GET /api/inventory/stores/:storeId/slots', () => {
    let brand;

    beforeEach(async () => {
        clearMockStorage();
        ({ headers: brand } = await signInAs('brand', { organizationId: 'brand-one' }));
        await seedBookableStore();
    });

    test('a Brand sees twelve Slots per operating hour before any schedule is generated', async () => {
        const response = await slotsFor(brand);

        expect(response.status).toBe(200);
        const { headers: admin } = await signInAs('admin');
        const generated = await request(app).get(`/api/loops?date=${DATE}&store_id=store-one`).set(admin);
        expect(generated.body.loops).toEqual([]);
        expect(response.body).toMatchObject({ store_id: 'store-one', date: DATE, is_closed: false });
        expect(response.body.hours.map(hour => hour.hour)).toEqual(
            Array.from({ length: 14 }, (_, index) => 8 + index),
        );
        expect(response.body.hours.every(hour => hour.slots.length === 12)).toBe(true);

        // The day's first hour follows the pattern from position 0 (ADR 0004).
        expect(response.body.hours[0].slots).toEqual([
            'paid', 'paid', 'retailer', 'paid', 'paid', 'internal',
            'paid', 'paid', 'retailer', 'paid', 'paid', 'paid',
        ].map((category, position) => ({
            position,
            category,
            // Only Paid Slots are bookable, so only they have a status.
            status: category === 'paid' ? 'free' : null,
        })));
        const paid = response.body.hours.flatMap(hour => hour.slots)
            .filter(slot => slot.category === 'paid');
        expect(paid).toHaveLength(118);
        expect(paid.every(slot => slot.status === 'free')).toBe(true);
    });

    test('never names another organization, even once loops name Campaigns', async () => {
        await loopRepository.create(`${DATE}_8_store-one`, {
            date: DATE, hour: 8, store_id: 'store-one', retailer_id: 'retailer-one',
            slots: [{ position: 0, campaign_id: 'rival-campaign', asset_id: 'rival-asset', asset_name: 'Rival Brand ad' }],
        });

        const response = await slotsFor(brand);

        expect(response.status).toBe(200);
        const serialized = JSON.stringify(response.body).toLowerCase();
        for (const privateValue of ['rival', 'northwind', 'retailer-one', 'campaign', 'asset', 'brand']) {
            expect(serialized).not.toContain(privateValue);
        }
    });

    test('a closed date has no Slots', async () => {
        await SpecialHoursRepository.create(`spec_store-one_${DATE}`, {
            store_id: 'store-one', date: DATE, is_closed: true,
        });

        const response = await slotsFor(brand);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ is_closed: true, hours: [] });
    });

    test('Stores a Brand cannot book are not found, and a malformed date is refused', async () => {
        await StoreRepository.create('store-hidden', {
            name: 'No Screens', retailer_id: 'retailer-one', status: 'active', time_zone: 'America/Toronto',
        });

        expect((await slotsFor(brand, 'store-hidden')).status).toBe(404);
        expect((await slotsFor(brand, 'store-missing')).status).toBe(404);
        expect((await slotsFor(brand, 'store-one', '2030-13-40')).status).toBe(400);
        expect((await request(app).get('/api/inventory/stores/store-one/slots').set(brand)).status).toBe(400);
    });

    test('Brands are still refused the full loop records', async () => {
        const loops = await request(app).get(`/api/loops?date=${DATE}&store_id=store-one`).set(brand);

        expect(loops.status).toBe(403);
    });

    test('other roles are refused Slot availability', async () => {
        const { headers: retailerAdmin } = await signInAs('retaileradmin', { organizationId: 'retailer-one' });

        expect((await slotsFor(retailerAdmin)).status).toBe(403);
    });
});
