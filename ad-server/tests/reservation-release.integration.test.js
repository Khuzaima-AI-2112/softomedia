import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const {
    creativeRepository,
    locationRepository,
    mediaRepository,
    retailerRepository,
    screenRepository,
    StoreRepository,
} = await import('../src/repositories/index.js');
const { default: BusinessHoursRepository } = await import('../src/repositories/BusinessHoursRepository.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');
const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

// Broadcast date D is Monday 2030-01-07 in Toronto (EST, UTC-5). The Store opens
// 08:00–10:00; position 3 of hour 8 is Paid. Bookings close 18:00 on D-2 and the
// approval deadline is 18:00 on D-1, Store time.
const DATE = '2030-01-07';
const MONDAY = 1;
const BOOKED = new Date('2030-01-01T12:00:00.000Z');
const BEFORE_DEADLINE = new Date('2030-01-06T22:59:59.000Z'); // 17:59:59 on D-1 in Toronto
const AT_DEADLINE = new Date('2030-01-06T23:00:00.000Z'); // 18:00 on D-1 in Toronto
const DURING_NINE = new Date('2030-01-07T14:30:00.000Z'); // 09:30 on D in Toronto: hour 8 has played
const POSITION = 3;
const OTHER_POSITION = 4; // Paid in both hour 8 and hour 9

const SELECTION = [{
    retailer_id: 'retailer-one',
    store_id: 'store-one',
    location_id: 'store-one-entrance',
    screen_id: 'store-one-screen',
}];

const approvedMedia = fields => ({ approval_status: 'approved', eligible_for_playback: true, status: 'ready', ...fields });

async function seed() {
    await retailerRepository.create('retailer-one', { name: 'Northwind Cafés', status: 'active' });
    await StoreRepository.create('store-one', {
        name: 'Northwind Downtown', retailer_id: 'retailer-one', status: 'active', time_zone: 'America/Toronto',
    });
    await locationRepository.create('store-one-entrance', {
        name: 'Entrance', store_id: 'store-one', retailer_id: 'retailer-one', status: 'active',
    });
    await screenRepository.create('store-one-screen', {
        name: 'Entrance Screen', store_id: 'store-one', location_id: 'store-one-entrance',
        retailer_id: 'retailer-one', status: 'ONLINE',
    });
    await BusinessHoursRepository.create(`def_store-one_${MONDAY}`, {
        store_id: 'store-one', day_of_week: MONDAY, is_closed: false, open_time: '08:00', close_time: '10:00',
    });
    await mediaRepository.create('fallback-media', approvedMedia({
        title: 'Neutral fallback', category: 'fallback', content_kind: 'neutral_fallback',
        owner_type: 'platform', owner_id: null,
    }));
    for (const brandId of ['brand-one', 'brand-two']) {
        await creativeRepository.create(`crv-${brandId}`, {
            brand_id: brandId, media_ids: [`${brandId}-file`], approval_status: 'approved',
        });
        await mediaRepository.create(`${brandId}-file`, {
            title: `${brandId} latte`, category: 'paid', owner_type: 'brand', owner_id: brandId, status: 'ready',
            mime_type: 'image/png', duration: 5, creative_id: `crv-${brandId}`,
        });
    }
}

/** Moves the clock and signs everyone in afresh, so their tokens are valid at the new time. */
async function signInAllAt(now) {
    jest.setSystemTime(now);
    const signIn = async (role, organizationId = null) =>
        signInAs(role, { organizationId, fakeClock: true });
    return {
        brand: await signIn('brand', 'brand-one'),
        brandTwo: await signIn('brand', 'brand-two'),
        retailer: await signIn('retaileradmin', 'retailer-one'),
        admin: await signIn('admin'),
        superadmin: await signIn('superadmin'),
    };
}

const book = (user, brandId, position = POSITION, hours = [8]) => request(app).post('/api/campaigns')
    .set(user.headers).send({
        name: `${brandId} breakfast`,
        media_id: `${brandId}-file`,
        start_date: DATE,
        end_date: DATE,
        budget: 100,
        inventory_selection: SELECTION,
        slots: hours.map(hour => ({ store_id: 'store-one', date: DATE, hour, position })),
    });

/** The status of a Slot as this user sees it. */
async function slotStatus(user, position = POSITION, hour = 8) {
    const response = await request(app).get(`/api/inventory/stores/store-one/slots?date=${DATE}`).set(user.headers);
    expect(response.status).toBe(200);
    return response.body.hours.find(candidate => candidate.hour === hour).slots[position].status;
}

const notifications = async user => (await request(app).get('/api/notifications').set(user.headers)).body;

const setStatus = (user, campaignId, status) => request(app)
    .patch(`/api/campaigns/${campaignId}/status`).set(user.headers).send({ status });

const cancel = (user, campaignId) => request(app).post(`/api/campaigns/${campaignId}/cancel`).set(user.headers);

async function generateHourEight(user) {
    const generated = await request(app).post('/api/loops/generate').set(user.headers)
        .send({ targetDate: DATE, retailerId: 'retailer-one', storeId: 'store-one' });
    expect(generated.status).toBe(201);
    return generated.body.loops.find(loop => loop.hour === 8).slots;
}

describeWithAuthEmulator('Releasing Slot Reservations', () => {
    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({ now: BOOKED, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
        await seed();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('rejecting a Campaign frees its Slots at once and tells the Brand why', async () => {
        const as = await signInAllAt(BOOKED);
        const booked = await book(as.brand, 'brand-one');
        expect(booked.status).toBe(201);
        expect(await slotStatus(as.brandTwo)).toBe('taken');

        const rejected = await setStatus(as.retailer, booked.body.id, 'rejected');
        expect(rejected.status).toBe(200);

        expect(await slotStatus(as.brandTwo)).toBe('free');
        expect(await slotStatus(as.brand)).toBe('free');
        expect((await book(as.brandTwo, 'brand-two')).status).toBe(201);
        expect(await notifications(as.brand)).toEqual([expect.objectContaining({
            title: 'Slot Reservation released',
            message: expect.stringContaining('rejected'),
            read: false,
        })]);
        expect(await notifications(as.brandTwo)).toEqual([]);
    });

    test('rejecting an approved Campaign also frees its Slots', async () => {
        const as = await signInAllAt(BOOKED);
        const booked = await book(as.brand, 'brand-one');
        expect((await setStatus(as.retailer, booked.body.id, 'approved')).status).toBe(200);
        expect((await setStatus(as.retailer, booked.body.id, 'rejected')).status).toBe(200);

        expect(await slotStatus(as.brandTwo)).toBe('free');
    });

    test('a Brand cancelling its Campaign frees its Slots at once and is told why', async () => {
        const as = await signInAllAt(BOOKED);
        const booked = await book(as.brand, 'brand-one');
        expect(await slotStatus(as.brandTwo)).toBe('taken');

        const cancelled = await cancel(as.brand, booked.body.id);

        expect(cancelled.status).toBe(200);
        expect(cancelled.body).toMatchObject({ id: booked.body.id, status: 'cancelled' });
        expect(await slotStatus(as.brandTwo)).toBe('free');
        expect((await book(as.brandTwo, 'brand-two')).status).toBe(201);
        expect(await notifications(as.brand)).toEqual([expect.objectContaining({
            title: 'Slot Reservation released',
            message: expect.stringContaining('cancelled'),
        })]);
    });

    test('only the owning Brand or an Admin may cancel, and a cancelled Campaign stays cancelled', async () => {
        const as = await signInAllAt(BOOKED);
        const booked = await book(as.brand, 'brand-one');

        expect((await cancel(as.brandTwo, booked.body.id)).status).toBe(403);
        expect((await cancel(as.retailer, booked.body.id)).status).toBe(403);
        expect((await cancel(as.brand, 'no-such-campaign')).status).toBe(404);
        expect(await slotStatus(as.brandTwo)).toBe('taken');

        expect((await cancel(as.admin, booked.body.id)).status).toBe(200);
        expect(await slotStatus(as.brandTwo)).toBe('free');

        const again = await cancel(as.brand, booked.body.id);
        expect(again.status).toBe(400);
        expect(again.body).toMatchObject({ from: 'cancelled' });
        expect((await setStatus(as.retailer, booked.body.id, 'approved')).status).toBe(400);
        // Released once, told once.
        expect(await notifications(as.brand)).toHaveLength(1);
    });

    test('an unapproved Campaign’s Slots are released at the approval deadline and not generated', async () => {
        let as = await signInAllAt(BOOKED);
        const unapproved = await book(as.brand, 'brand-one', POSITION);
        const approved = await book(as.brandTwo, 'brand-two', OTHER_POSITION);
        expect((await setStatus(as.retailer, approved.body.id, 'approved')).status).toBe(200);

        // Still held a second before the deadline.
        as = await signInAllAt(BEFORE_DEADLINE);
        expect(await slotStatus(as.brand)).toBe('yours');
        expect(await notifications(as.brand)).toEqual([]);

        as = await signInAllAt(AT_DEADLINE);
        expect(await slotStatus(as.brandTwo, POSITION)).toBe('free');
        expect(await slotStatus(as.brand, POSITION)).toBe('free');
        // An approved Campaign keeps its Slot.
        expect(await slotStatus(as.brandTwo, OTHER_POSITION)).toBe('yours');

        const slots = await generateHourEight(as.admin);
        expect(slots[POSITION]).toMatchObject({ is_fallback: true, campaign_id: null, asset_id: 'fallback-media' });
        expect(slots[OTHER_POSITION]).toMatchObject({ is_fallback: false, campaign_id: approved.body.id });

        // Approving after the deadline does not bring the Slot back.
        expect((await setStatus(as.retailer, unapproved.body.id, 'approved')).status).toBe(200);
        expect(await slotStatus(as.brand, POSITION)).toBe('free');

        expect(await notifications(as.brand)).toEqual([expect.objectContaining({
            title: 'Slot Reservation released',
            message: expect.stringContaining('approval deadline'),
        })]);
        expect(await notifications(as.brandTwo)).toEqual([]);
    });

    test('generation alone releases an unapproved Reservation after the deadline', async () => {
        let as = await signInAllAt(BOOKED);
        await book(as.brand, 'brand-one');

        as = await signInAllAt(AT_DEADLINE);
        const slots = await generateHourEight(as.admin);

        expect(slots[POSITION]).toMatchObject({ is_fallback: true, campaign_id: null });
        expect(await notifications(as.brand)).toHaveLength(1);
    });

    test('approving after the deadline releases the Slots even when nothing read them in between', async () => {
        let as = await signInAllAt(BOOKED);
        const unapproved = await book(as.brand, 'brand-one');

        as = await signInAllAt(AT_DEADLINE);
        expect((await setStatus(as.retailer, unapproved.body.id, 'approved')).status).toBe(200);

        const slots = await generateHourEight(as.admin);
        expect(slots[POSITION]).toMatchObject({ is_fallback: true, campaign_id: null });
        const [notice] = await notifications(as.brand);
        expect(notice.message).toContain('approval deadline');
        // Booking for the date closed before the deadline, so no one else can take the Slot.
        expect(notice.message).not.toContain('Other Brands');
    });

    test('cancelling a live Campaign releases only the Slots still to play', async () => {
        let as = await signInAllAt(BOOKED);
        const booked = await book(as.brand, 'brand-one', OTHER_POSITION, [8, 9]);
        expect(booked.status).toBe(201);
        expect((await setStatus(as.retailer, booked.body.id, 'approved')).status).toBe(200);
        expect((await setStatus(as.retailer, booked.body.id, 'live')).status).toBe(200);

        as = await signInAllAt(DURING_NINE);
        expect((await cancel(as.brand, booked.body.id)).status).toBe(200);

        // Hour 8 has played and stays on record; the hour still playing is released.
        expect(await slotStatus(as.brandTwo, OTHER_POSITION, 8)).toBe('taken');
        expect(await slotStatus(as.brandTwo, OTHER_POSITION, 9)).toBe('free');
        const [notice] = await notifications(as.brand);
        expect(notice.message).toContain('09:00');
        expect(notice.message).not.toContain('08:00');
    });

    test('deleting a Campaign releases its Slots and tells the Brand', async () => {
        const as = await signInAllAt(BOOKED);
        const booked = await book(as.brand, 'brand-one');

        expect((await request(app).delete(`/api/campaigns/${booked.body.id}`).set(as.superadmin.headers)).status)
            .toBe(204);

        expect(await slotStatus(as.brandTwo)).toBe('free');
        expect(await notifications(as.brand)).toEqual([expect.objectContaining({
            message: expect.stringContaining('the Campaign was deleted'),
        })]);
    });
});
