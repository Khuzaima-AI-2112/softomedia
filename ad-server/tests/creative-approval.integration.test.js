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
    slotReservationRepository,
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
const REVOKED = new Date('2030-01-07T13:20:00.000Z'); // Monday 08:20, after Monday's approval deadline
const LATER_THIS_HOUR = new Date('2030-01-07T13:40:00.000Z'); // Monday 08:40
const NEXT_HOUR = new Date('2030-01-07T14:00:30.000Z'); // Monday 09:00:30
const LATER_NEXT_HOUR = new Date('2030-01-07T14:30:00.000Z'); // Monday 09:30
const NEXT_PAID = 4; // position 4 of hour 9 is a Paid Slot

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
    // Creatives the Brand could substitute: one of one file, one of two; and another Brand's.
    const brandCreative = async (id, brandId, fileIds) => {
        await creativeRepository.create(id, { title: id, brand_id: brandId, media_ids: fileIds, approval_status: 'pending' });
        for (const fileId of fileIds) {
            await mediaRepository.create(fileId, {
                title: fileId, category: 'paid', owner_type: 'brand', owner_id: brandId, status: 'ready',
                mime_type: 'image/png', duration: 5, creative_id: id,
            });
        }
    };
    await brandCreative('crv-mocha', 'brand-one', ['mocha-file']);
    await brandCreative('crv-duo', 'brand-one', ['duo-file-1', 'duo-file-2']);
    await advertiserRepository.create('brand-two', { name: 'Other Brand', status: 'active' });
    await brandCreative('crv-foreign', 'brand-two', ['foreign-file']);
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

const decide = (headers, action, body = {}) => decideOn('crv-latte', headers, action, body);
const decideOn = (creativeId, headers, action, body = {}) =>
    request(app).post(`/api/creatives/${creativeId}/${action}`).set(headers).send(body);

/** A booking of the Maple latte in several Slots of one Store and date, as [hour, position] pairs. */
const bookSlots = (headers, storeId, date, picks) => request(app).post('/api/campaigns').set(headers).send({
    name: `Latte at ${storeId}`,
    media_id: 'latte-file',
    start_date: date,
    end_date: date,
    budget: 100,
    inventory_selection: [{
        retailer_id: STORES[storeId], store_id: storeId,
        location_id: `${storeId}-entrance`, screen_id: `${storeId}-screen`,
    }],
    slots: picks.map(([hour, position]) => ({ store_id: storeId, date, hour, position })),
});

/** Whether the signed-in user may revoke the Maple latte now. */
const revocable = async headers => {
    const response = await request(app).get('/api/creatives').set(headers);
    expect(response.status).toBe(200);
    return response.body.find(creative => creative.id === 'crv-latte').revocable_by_you;
};

const substitute = (headers, campaignId, creativeId) =>
    request(app).post(`/api/campaigns/${campaignId}/creative`).set(headers).send({ creative_id: creativeId });

const brandNotifications = async (headers, title) => {
    const response = await request(app).get('/api/notifications').set(headers);
    expect(response.status).toBe(200);
    return response.body.filter(notification => notification.title === title);
};

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

const playback = async storeId => {
    const response = await request(app).get('/api/device/playback').set('Authorization', device(storeId));
    expect(response.status).toBe(200);
    return response.body;
};

/** The Screen's report that it presented this Slot of the Maple latte a second ago. */
const proofOfPlay = (storeId, played, position, campaignId) => request(app)
    .post('/api/device/proof-of-play')
    .set('Authorization', device(storeId))
    .send({
        event_id: `pop-${storeId}-${played.hour}-${position}`,
        screen_id: `${storeId}-screen`,
        location_id: `${storeId}-entrance`,
        loop_id: played.loop_id,
        slot_position: position,
        campaign_id: campaignId,
        asset_id: 'latte-file',
        presentation_started_at: new Date(Date.now() - 1_000).toISOString(),
        intended_duration_seconds: 5,
    });

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

        // Every Reservation places the Creative; whether it may play is checked when the Slot plays.
        as = await signInAllAt(GENERATED);
        const downtown = await reservedSlot(as.admin, 'north-downtown', MONDAY);
        expect(downtown.slot).toMatchObject({ is_fallback: false, asset_id: 'latte-file', campaign_id: bookings[0].body.id });
        expect((await reservedSlot(as.admin, 'north-uptown', TUESDAY)).slot)
            .toMatchObject({ is_fallback: false, asset_id: 'latte-file', campaign_id: bookings[1].body.id });
        expect((await reservedSlot(as.admin, 'north-downtown', TUESDAY)).slot)
            .toMatchObject({ is_fallback: false, asset_id: 'latte-file' });
        expect((await reservedSlot(as.admin, 'harbor-pier', MONDAY)).slot)
            .toMatchObject({ is_fallback: false, asset_id: 'latte-file', campaign_id: harborBooking.body.id });

        // Northwind's Screen plays it; nobody approves the Campaign or the hour.
        as = await signInAllAt(PLAYING);
        expect((await playback('north-downtown')).slots[PAID]).toMatchObject({
            presentation_type: 'campaign', counts_as_delivery: true, asset_id: 'latte-file',
        });
        // Harbor's Screen plays Fallback Content until Harbor approves, then the Creative, without regenerating.
        expect((await playback('harbor-pier')).slots[PAID]).toMatchObject({ presentation_type: 'fallback' });
        expect((await decide(as.harbor, 'approve')).status).toBe(200);
        expect((await playback('harbor-pier')).slots[PAID]).toMatchObject({
            presentation_type: 'campaign', campaign_id: harborBooking.body.id, asset_id: 'latte-file',
        });
    });

    test('a Creative a Retailer rejected never plays in its Stores', async () => {
        let as = await signInAllAt(BOOKED);
        expect((await book(as.brand, 'harbor-pier', MONDAY)).status).toBe(201);
        expect((await decide(as.superadmin, 'approve')).status).toBe(200);
        expect((await decide(as.harbor, 'reject', { reason: 'Not for our shoppers' })).status).toBe(200);

        as = await signInAllAt(GENERATED);
        await reservedSlot(as.admin, 'harbor-pier', MONDAY);
        await signInAllAt(PLAYING);
        expect((await playback('harbor-pier')).slots[PAID]).toMatchObject({
            presentation_type: 'fallback', counts_as_delivery: false, campaign_id: null,
        });
    });
});

describeWithAuthEmulator('Revoking a Creative', () => {
    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({ now: BOOKED, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
        await seedNetwork();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    /** The Maple latte booked at Northwind Downtown on Monday at 08:00 and 09:00, approved and scheduled. */
    async function playingLatte() {
        let as = await signInAllAt(BOOKED);
        const booking = await bookSlots(as.brand, 'north-downtown', MONDAY, [[8, PAID], [9, NEXT_PAID]]);
        expect(booking.status).toBe(201);
        expect((await decide(as.superadmin, 'approve')).status).toBe(200);
        expect((await decide(as.northwind, 'approve')).status).toBe(200);
        as = await signInAllAt(GENERATED);
        await reservedSlot(as.admin, 'north-downtown', MONDAY);
        return booking.body;
    }

    test('the hour it is revoked in plays on; every later hour plays Fallback Content and records no Proof of Play', async () => {
        const campaign = await playingLatte();

        let as = await signInAllAt(REVOKED);
        const revoked = await decide(as.superadmin, 'revoke', { reason: 'Offer has ended' });
        expect(revoked.status).toBe(200);
        expect(revoked.body).toMatchObject({ approval_status: 'revoked', reason: 'Offer has ended' });

        await signInAllAt(LATER_THIS_HOUR);
        const thisHour = await playback('north-downtown');
        expect(thisHour.hour).toBe(8);
        expect(thisHour.slots[PAID]).toMatchObject({ presentation_type: 'campaign', asset_id: 'latte-file' });
        expect((await proofOfPlay('north-downtown', thisHour, PAID, campaign.id)).status).toBe(201);

        as = await signInAllAt(NEXT_HOUR);
        const nextHour = await playback('north-downtown');
        expect(nextHour.hour).toBe(9);
        expect(nextHour.slots[NEXT_PAID]).toMatchObject({
            presentation_type: 'fallback', counts_as_delivery: false, campaign_id: null,
        });
        expect((await proofOfPlay('north-downtown', nextHour, NEXT_PAID, campaign.id)).status).toBe(422);

        // The Brand keeps its Reservations and is told why its Slots play Fallback Content.
        expect(await slotReservationRepository.findHeldForCampaign(campaign.id)).toHaveLength(2);
        expect(await brandNotifications(as.brand, 'Creative revoked')).toEqual([expect.objectContaining({
            message: expect.stringMatching(/^“Maple latte” was revoked by the Super Administrator: Offer has ended\. .*substitute/),
        })]);
    });

    test('a Retailer revokes the approval it gave, for its own Stores only, and only once', async () => {
        let as = await signInAllAt(BOOKED);
        expect((await book(as.brand, 'north-downtown', MONDAY)).status).toBe(201);
        expect((await book(as.brand, 'harbor-pier', MONDAY)).status).toBe(201);
        expect((await decide(as.superadmin, 'approve')).status).toBe(200);
        // Only an approval the Retailer gave can be revoked.
        expect((await decide(as.harbor, 'revoke', { reason: 'Menu changed' })).status).toBe(409);
        expect((await decide(as.northwind, 'approve')).status).toBe(200);
        expect((await decide(as.harbor, 'approve')).status).toBe(200);
        expect(await revocable(as.harbor)).toBe(true);
        expect(await revocable(as.superadmin)).toBe(true);
        expect(await revocable(as.admin)).toBe(false);

        const revoked = await decide(as.harbor, 'revoke', { reason: 'Menu changed' });
        expect(revoked.status).toBe(200);
        expect(revoked.body.retailer_approvals).toEqual([
            expect.objectContaining({ retailer_id: 'harbor', status: 'revoked', reason: 'Menu changed' }),
        ]);
        // Revoking is final.
        expect(await revocable(as.harbor)).toBe(false);
        expect(await revocable(as.northwind)).toBe(true);
        expect((await decide(as.harbor, 'revoke', { reason: 'Again' })).status).toBe(409);
        expect((await decide(as.harbor, 'approve')).status).toBe(409);
        expect(await brandNotifications(as.brand, 'Creative revoked')).toEqual([expect.objectContaining({
            message: expect.stringContaining('“Maple latte” was revoked by Harbor Bakeries for its Stores: Menu changed.'),
        })]);

        as = await signInAllAt(GENERATED);
        await reservedSlot(as.admin, 'north-downtown', MONDAY);
        await reservedSlot(as.admin, 'harbor-pier', MONDAY);
        await signInAllAt(PLAYING);
        expect((await playback('harbor-pier')).slots[PAID]).toMatchObject({ presentation_type: 'fallback' });
        expect((await playback('north-downtown')).slots[PAID]).toMatchObject({
            presentation_type: 'campaign', asset_id: 'latte-file',
        });
    });

    test('the Brand substitutes another of its Creatives into its Reservations, which plays once approved', async () => {
        const campaign = await playingLatte();
        let as = await signInAllAt(REVOKED);
        expect((await decide(as.superadmin, 'revoke', { reason: 'Offer has ended' })).status).toBe(200);

        // Only the Brand substitutes, and only its own Creative of as many files, which may still play.
        expect((await substitute(as.admin, campaign.id, 'crv-mocha')).status).toBe(403);
        expect((await substitute(as.brand, campaign.id, 'crv-foreign')).status).toBe(404);
        expect((await substitute(as.brand, campaign.id, 'crv-duo')).body).toEqual({
            error: 'The Creative must have 1 file, like the one it replaces',
        });
        expect((await substitute(as.brand, campaign.id, 'crv-latte')).status).toBe(409);

        const substituted = await substitute(as.brand, campaign.id, 'crv-mocha');
        expect(substituted.status).toBe(200);
        expect(substituted.body).toMatchObject({ creative_id: 'crv-mocha', media_id: 'mocha-file' });
        // Monday's approval deadline has passed, but the Reservations had both approvals at it, so they are kept.
        expect(await slotReservationRepository.findHeldForCampaign(campaign.id)).toHaveLength(2);

        // Until both approve the substitute, its Slots play Fallback Content.
        as = await signInAllAt(NEXT_HOUR);
        expect((await playback('north-downtown')).slots[NEXT_PAID]).toMatchObject({ presentation_type: 'fallback' });
        expect((await decideOn('crv-mocha', as.superadmin, 'approve')).status).toBe(200);
        expect((await decideOn('crv-mocha', as.northwind, 'approve')).status).toBe(200);
        expect(await slotReservationRepository.findHeldForCampaign(campaign.id)).toHaveLength(2);

        // Then it plays in the loop already generated, without regenerating it.
        await signInAllAt(LATER_NEXT_HOUR);
        expect((await playback('north-downtown')).slots[NEXT_PAID]).toMatchObject({
            presentation_type: 'campaign', counts_as_delivery: true, campaign_id: campaign.id, asset_id: 'mocha-file',
        });
    });
});
