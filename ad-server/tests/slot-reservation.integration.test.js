import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const {
    campaignRepository,
    locationRepository,
    mediaRepository,
    retailerRepository,
    screenRepository,
    StoreRepository,
} = await import('../src/repositories/index.js');
const { default: BusinessHoursRepository } = await import('../src/repositories/BusinessHoursRepository.js');
const { slotReservationRepository } = await import('../src/repositories/SlotReservationRepository.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');

const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

// 2030-01-07 is a Monday. Its Booking Cutoff is 18:00 on Saturday 5 January in
// Toronto, which is 23:00 UTC (EST is UTC-5).
const DATE = '2030-01-07';
const MONDAY = 1;
const CUTOFF = new Date('2030-01-05T23:00:00.000Z');

const SELECTION = [{
    retailer_id: 'retailer-one',
    store_id: 'store-one',
    location_id: 'store-one-entrance',
    screen_id: 'store-one-screen',
}];

async function seedBookableStore() {
    await retailerRepository.create('retailer-one', { name: 'Northwind Cafés', status: 'active' });
    await StoreRepository.create('store-one', {
        name: 'Northwind Downtown',
        retailer_id: 'retailer-one',
        status: 'active',
        time_zone: 'America/Toronto',
        cpm_traffic_tier: 'high',
    });
    await locationRepository.create('store-one-entrance', {
        name: 'Entrance', store_id: 'store-one', retailer_id: 'retailer-one', status: 'active',
    });
    await screenRepository.create('store-one-screen', {
        name: 'Entrance Screen', store_id: 'store-one', location_id: 'store-one-entrance',
        retailer_id: 'retailer-one', status: 'active',
    });
    await BusinessHoursRepository.create(`def_store-one_${MONDAY}`, {
        store_id: 'store-one', day_of_week: MONDAY, is_closed: false, open_time: '08:00', close_time: '22:00',
    });
}

async function seedCreative(brandId) {
    await mediaRepository.create(`${brandId}-creative`, {
        category: 'paid', owner_type: 'brand', owner_id: brandId, mime_type: 'image/png', duration: 5,
    });
}

const slot = (hour, position, overrides = {}) => ({ store_id: 'store-one', date: DATE, hour, position, ...overrides });

const submit = (headers, brandId, slots, overrides = {}) => request(app)
    .post('/api/campaigns')
    .set(headers)
    .send({
        name: `${brandId} breakfast`,
        media_id: `${brandId}-creative`,
        start_date: DATE,
        end_date: DATE,
        budget: 100,
        inventory_selection: SELECTION,
        slots,
        ...overrides,
    });

const slotsFor = (headers, date = DATE) => request(app)
    .get(`/api/inventory/stores/store-one/slots?date=${date}`)
    .set(headers);

const paidSlot = (availability, hour, position) => availability.hours
    .find(candidate => candidate.hour === hour).slots[position];

describeWithAuthEmulator('Slot Reservations', () => {
    let brand;
    let rival;

    const signInBrands = async () => {
        ({ headers: brand } = await signInAs('brand', { organizationId: 'brand-one', fakeClock: true }));
        ({ headers: rival } = await signInAs('brand', { organizationId: 'brand-two', fakeClock: true }));
    };

    // Tokens are re-issued at the new time so they are neither expired nor not yet valid.
    const setClock = async now => {
        jest.setSystemTime(now);
        await signInBrands();
    };

    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({
            now: new Date('2030-01-01T12:00:00.000Z'),
            doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'],
        });
        await signInBrands();
        await seedBookableStore();
        await seedCreative('brand-one');
        await seedCreative('brand-two');
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('submitting a Campaign with Slot picks holds a Reservation for each Slot', async () => {
        const response = await submit(brand, 'brand-one', [slot(8, 0), slot(12, 3)]);

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('pending_approval');
        expect(response.body.reserved_slots).toEqual([
            { ...slot(8, 0), price: 15.75 },
            { ...slot(12, 3), price: 33.75 },
        ]);
        expect(response.body).not.toHaveProperty('selected_slots');

        const reservations = await slotReservationRepository.findAll();
        expect(reservations).toHaveLength(2);
        expect(reservations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                ...slot(8, 0), campaign_id: response.body.id, brand_id: 'brand-one', status: 'held', price: 15.75,
            }),
            expect.objectContaining({ ...slot(12, 3), campaign_id: response.body.id, brand_id: 'brand-one' }),
        ]));
    });

    test('two concurrent submissions for one Slot give exactly one Reservation; the other gets a 409', async () => {
        const [first, second] = await Promise.all([
            submit(brand, 'brand-one', [slot(9, 1), slot(9, 2)]),
            submit(rival, 'brand-two', [slot(9, 2)]),
        ]);

        expect([first.status, second.status].sort()).toEqual([201, 409]);
        const refused = first.status === 409 ? first : second;
        expect(refused.body).toMatchObject({ code: 'SLOT_TAKEN', slots: [slot(9, 2)] });
        expect(refused.body.error).toMatch(/choose another/i);

        const reservations = await slotReservationRepository.findAll();
        const heldSlot = reservations.filter(reservation => reservation.hour === 9 && reservation.position === 2);
        expect(heldSlot).toHaveLength(1);
        // A refused submission reserves nothing and creates no Campaign.
        expect(await campaignRepository.findAll()).toHaveLength(1);
        expect(reservations).toHaveLength(first.status === 201 ? 2 : 1);
    });

    test('another Brand sees a held Slot as taken, never who holds it; the holder sees it as theirs', async () => {
        const created = await submit(brand, 'brand-one', [slot(8, 0)]);
        expect(created.status).toBe(201);

        const theirs = await slotsFor(brand);
        const others = await slotsFor(rival);

        expect(paidSlot(theirs.body, 8, 0).status).toBe('yours');
        expect(paidSlot(others.body, 8, 0).status).toBe('taken');
        expect(paidSlot(others.body, 8, 1).status).toBe('free');
        const serialized = JSON.stringify(others.body).toLowerCase();
        for (const privateValue of ['brand-one', created.body.id.toLowerCase(), 'campaign', 'breakfast']) {
            expect(serialized).not.toContain(privateValue);
        }

        const retry = await submit(rival, 'brand-two', [slot(8, 0)]);
        expect(retry.status).toBe(409);
    });

    test('every Paid Slot is quoted at the Store tier times the hour tier, whatever its position', async () => {
        const response = await slotsFor(brand);

        expect(response.status).toBe(200);
        // Base 15 CPM x high Store tier 1.5 x the hour's tier.
        const byHour = Object.fromEntries(response.body.hours.map(hour => [hour.hour, hour]));
        expect(byHour[8]).toMatchObject({ tier: 'low', price: 15.75 }); // x 0.7
        expect(byHour[12]).toMatchObject({ tier: 'high', price: 33.75 }); // x 1.5
        expect(byHour[14]).toMatchObject({ tier: 'medium', price: 22.5 }); // x 1.0

        const created = await submit(brand, 'brand-one', [slot(14, 1), slot(14, 11)]);
        expect(created.body.reserved_slots.map(reserved => reserved.price)).toEqual([22.5, 22.5]);
    });

    test('reservations for a date are refused from 18:00 two days before, Store time', async () => {
        await setClock(new Date(CUTOFF.getTime() - 1));
        const open = await slotsFor(brand);
        expect(open.body).toMatchObject({
            booking_open: true,
            booking_cutoff: { date: '2030-01-05', time: '18:00', time_zone: 'America/Toronto' },
        });
        expect((await submit(brand, 'brand-one', [slot(8, 0)])).status).toBe(201);

        await setClock(CUTOFF);
        const closed = await slotsFor(brand);
        expect(closed.body.booking_open).toBe(false);
        const refused = await submit(rival, 'brand-two', [slot(8, 1)]);
        expect(refused.status).toBe(400);
        expect(refused.body.code).toBe('BOOKING_CLOSED');
        expect(refused.body.error).toMatch(/18:00 on 2030-01-05 \(America\/Toronto\)/);
        expect(await slotReservationRepository.findAll()).toHaveLength(1);

        // The next date is still open.
        expect((await slotsFor(brand, '2030-01-08')).body.booking_open).toBe(true);
    });

    test('a Store with no time zone takes no Reservations, since its Booking Cutoff is unknown', async () => {
        await StoreRepository.update('store-one', { time_zone: null });

        expect((await slotsFor(brand)).body.booking_open).toBe(false);
        const refused = await submit(brand, 'brand-one', [slot(8, 0)]);
        expect(refused.status).toBe(400);
        expect(refused.body.code).toBe('BOOKING_CLOSED');
        expect(await slotReservationRepository.findAll()).toEqual([]);
    });

    test('only free Paid Slots in the Campaign and its Stores can be reserved', async () => {
        const refusals = [
            [],
            [slot(8, 2)], // Retailer Slot
            [slot(8, 5)], // Internal Slot
            [slot(7, 0)], // before opening
            [slot(8, 12)],
            [slot(8, 0), slot(8, 0)],
            [slot(8, 0, { store_id: 'store-other' })],
            [slot(8, 0, { date: '2030-01-08' })], // outside the Campaign's dates
            [slot(8, 0, { date: '2030-02-30' })],
        ];

        for (const slots of refusals) {
            const response = await submit(brand, 'brand-one', slots);
            expect({ slots, status: response.status }).toEqual({ slots, status: 400 });
        }
        expect((await submit(brand, 'brand-one', undefined)).status).toBe(400);
        expect(await slotReservationRepository.findAll()).toEqual([]);
        expect(await campaignRepository.findAll()).toEqual([]);
    });

    test('the retired 12-campaigns-per-location limit no longer refuses a submission', async () => {
        for (let index = 0; index < 12; index++) {
            await campaignRepository.create(`existing-${index}`, {
                status: 'approved', location_id: 'store-one-entrance', start_date: DATE, end_date: DATE,
            });
        }

        const response = await submit(brand, 'brand-one', [slot(8, 0)], { location_id: 'store-one-entrance' });

        expect(response.status).toBe(201);
    });
});
