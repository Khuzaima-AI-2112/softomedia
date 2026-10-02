import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const {
    advertiserRepository,
    creativeRepository,
    locationRepository,
    mediaRepository,
    retailerRepository,
    screenRepository,
    StoreRepository,
} = await import('../src/repositories/index.js');
const { default: BusinessHoursRepository } = await import('../src/repositories/BusinessHoursRepository.js');
const { deviceCredentialService } = await import('../src/services/DeviceCredentialService.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');
const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

// Monday 2030-01-07 and Tuesday 2030-01-08 in Toronto. Each Store opens at
// 08:00, so position 3 of hour 8 is a Paid Slot (ADR 0004).
const MONDAY = '2030-01-07';
const TUESDAY = '2030-01-08';
const PAID = 3;
const BOOKED = new Date('2030-01-01T12:00:00.000Z');
const GENERATED = new Date('2030-01-05T14:00:00.000Z');
const PLAYING = new Date('2030-01-07T13:00:30.000Z'); // Monday 08:00:30 in Toronto

// Northwind has two Stores; Harbor has one.
const STORES = {
    'north-downtown': 'northwind',
    'north-uptown': 'northwind',
    'harbor-pier': 'harbor',
};
const deviceKeys = {};

async function seedNetwork() {
    await retailerRepository.create('northwind', { name: 'Northwind Cafés', status: 'active' });
    await retailerRepository.create('harbor', { name: 'Harbor Bakeries', status: 'active' });
    for (const [storeId, retailerId] of Object.entries(STORES)) {
        await StoreRepository.create(storeId, {
            name: storeId, retailer_id: retailerId, status: 'active', time_zone: 'America/Toronto',
        });
        await locationRepository.create(`${storeId}-entrance`, {
            name: 'Entrance', store_id: storeId, retailer_id: retailerId, status: 'active',
        });
        const credential = deviceCredentialService.newCredential();
        deviceKeys[storeId] = credential.deviceKey;
        await screenRepository.create(`${storeId}-screen`, {
            ...credential.fields, name: 'Entrance Screen', store_id: storeId,
            location_id: `${storeId}-entrance`, retailer_id: retailerId, status: 'ONLINE',
        });
        for (const day of [1, 2]) {
            await BusinessHoursRepository.create(`def_${storeId}_${day}`, {
                store_id: storeId, day_of_week: day, is_closed: false, open_time: '08:00', close_time: '10:00',
            });
        }
    }
    await mediaRepository.create('fallback-media', {
        title: 'Neutral fallback', category: 'fallback', content_kind: 'neutral_fallback', owner_type: 'platform',
        owner_id: null, approval_status: 'approved', eligible_for_playback: true, status: 'ready',
    });
    await advertiserRepository.create('brand-one', { name: 'Morning Roast', status: 'active' });
    // The Brand's upload: a pending Creative of one file.
    await creativeRepository.create('crv-latte', {
        title: 'Maple latte', brand_id: 'brand-one', media_ids: ['latte-file'], approval_status: 'pending',
    });
    await mediaRepository.create('latte-file', {
        title: 'Maple latte', category: 'paid', owner_type: 'brand', owner_id: 'brand-one', status: 'ready',
        mime_type: 'image/png', duration: 5, creative_id: 'crv-latte',
    });
}

/** Moves the clock and signs everyone in afresh, so their tokens are valid at the new time. */
async function signInAllAt(now) {
    jest.setSystemTime(now);
    const headersFor = async (role, organizationId = null) =>
        (await signInAs(role, { organizationId, fakeClock: true })).headers;
    return {
        brand: await headersFor('brand', 'brand-one'),
        superadmin: await headersFor('superadmin'),
        admin: await headersFor('admin'),
        northwind: await headersFor('retaileradmin', 'northwind'),
        harbor: await headersFor('retaileradmin', 'harbor'),
    };
}

const book = (headers, storeId, date) => request(app).post('/api/campaigns').set(headers).send({
    name: `Latte at ${storeId} on ${date}`,
    media_id: 'latte-file',
    start_date: date,
    end_date: date,
    budget: 100,
    inventory_selection: [{
        retailer_id: STORES[storeId], store_id: storeId,
        location_id: `${storeId}-entrance`, screen_id: `${storeId}-screen`,
    }],
    slots: [{ store_id: storeId, date, hour: 8, position: PAID }],
});

const decide = (headers, action, body = {}) =>
    request(app).post(`/api/creatives/crv-latte/${action}`).set(headers).send(body);

const awaitingNotifications = async headers => {
    const response = await request(app).get('/api/notifications').set(headers);
    expect(response.status).toBe(200);
    return response.body.filter(({ title }) => title === 'Creative awaiting approval');
};

/** What the reserved Slot holds once the Store's loops for the date are generated. */
async function reservedSlot(headers, storeId, date) {
    const generated = await request(app).post('/api/loops/generate').set(headers)
        .send({ targetDate: date, retailerId: STORES[storeId], storeId });
    expect(generated.status).toBe(201);
    const eightAm = generated.body.loops.find(loop => loop.hour === 8);
    return { loop: eightAm, slot: eightAm.slots[PAID] };
}

const device = storeId => `Device ${storeId}-screen:${deviceKeys[storeId]}`;

describeWithAuthEmulator('Approving a Creative once, by the Super Administrator and each Retailer', () => {
    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({ now: BOOKED, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
        await seedNetwork();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('an approved Creative plays in every Reservation that uses it, with no further approval', async () => {
        let as = await signInAllAt(BOOKED);
        const bookings = [
            await book(as.brand, 'north-downtown', MONDAY),
            await book(as.brand, 'north-uptown', TUESDAY),
        ];
        expect(bookings.map(booking => booking.status)).toEqual([201, 201]);

        // The Super Administrator approves; only then is Northwind asked, once.
        expect(await awaitingNotifications(as.northwind)).toEqual([]);
        expect((await decide(as.superadmin, 'approve')).status).toBe(200);
        expect(await awaitingNotifications(as.northwind)).toEqual([expect.objectContaining({
            message: '“Maple latte” from Morning Roast is waiting for your approval.',
        })]);

        // A booking that brings Harbor in asks Harbor; one in a Store of Northwind's asks no one again.
        const harborBooking = await book(as.brand, 'harbor-pier', MONDAY);
        expect(harborBooking.status).toBe(201);
        expect(await awaitingNotifications(as.harbor)).toHaveLength(1);
        expect((await book(as.brand, 'north-downtown', TUESDAY)).status).toBe(201);
        expect(await awaitingNotifications(as.northwind)).toHaveLength(1);

        // Northwind approves once.
        expect((await decide(as.northwind, 'approve')).status).toBe(200);

        // Every Northwind Reservation places the Creative; Harbor's Store doesn't until Harbor approves.
        as = await signInAllAt(GENERATED);
        const downtown = await reservedSlot(as.admin, 'north-downtown', MONDAY);
        expect(downtown.slot).toMatchObject({ is_fallback: false, asset_id: 'latte-file', campaign_id: bookings[0].body.id });
        expect((await reservedSlot(as.admin, 'north-uptown', TUESDAY)).slot)
            .toMatchObject({ is_fallback: false, asset_id: 'latte-file', campaign_id: bookings[1].body.id });
        expect((await reservedSlot(as.admin, 'north-downtown', TUESDAY)).slot)
            .toMatchObject({ is_fallback: false, asset_id: 'latte-file' });
        expect((await reservedSlot(as.admin, 'harbor-pier', MONDAY)).slot)
            .toMatchObject({ is_fallback: true, asset_id: 'fallback-media', campaign_id: null });

        expect((await decide(as.harbor, 'approve')).status).toBe(200);
        expect((await reservedSlot(as.admin, 'harbor-pier', MONDAY)).slot)
            .toMatchObject({ is_fallback: false, asset_id: 'latte-file', campaign_id: harborBooking.body.id });

        // Northwind's Screen plays it, with the Campaign and its hour approved as before.
        expect((await request(app).patch(`/api/campaigns/${bookings[0].body.id}/status`)
            .set(as.northwind).send({ status: 'approved' })).status).toBe(200);
        expect((await request(app).patch(`/api/loops/${downtown.loop.id}/approve`).set(as.northwind)).status).toBe(200);
        await signInAllAt(PLAYING);
        const playback = await request(app).get('/api/device/playback').set('Authorization', device('north-downtown'));
        expect(playback.status).toBe(200);
        expect(playback.body.slots[PAID]).toMatchObject({
            presentation_type: 'campaign', counts_as_delivery: true, asset_id: 'latte-file',
        });
    });

    test('a Creative a Retailer rejected never plays in its Stores', async () => {
        let as = await signInAllAt(BOOKED);
        expect((await book(as.brand, 'harbor-pier', MONDAY)).status).toBe(201);
        expect((await decide(as.superadmin, 'approve')).status).toBe(200);
        expect((await decide(as.harbor, 'reject', { reason: 'Not for our shoppers' })).status).toBe(200);

        as = await signInAllAt(GENERATED);
        expect((await reservedSlot(as.admin, 'harbor-pier', MONDAY)).slot).toMatchObject({ is_fallback: true });
    });
});
