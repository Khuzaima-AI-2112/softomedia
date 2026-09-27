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
    creativeRepository,
    impressionRepository,
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

// Broadcast date D is Monday 2030-01-07 in Toronto (EST, UTC-5). The Store opens
// at 08:00, so hour 8 follows the allocation pattern from position 0:
// paid, paid, retailer, paid, paid, internal, paid, paid, retailer, paid, paid, paid.
const DATE = '2030-01-07';
const MONDAY = 1;
const BOOKED = new Date('2030-01-01T12:00:00.000Z');
const GENERATED = new Date('2030-01-05T14:00:00.000Z'); // 09:00 on D-2, while bookings are still open
const APPROVED = new Date('2030-01-06T15:00:00.000Z'); // before the 18:00 D-1 approval deadline
const PLAYING = new Date('2030-01-07T13:00:30.000Z'); // 08:00:30 in Toronto

const RESERVED = 3; // Brand One's approved Creative
const UNAPPROVED_CREATIVE = 4; // Brand Two's Creative, not approved
const LATE_APPROVAL = 6; // Brand Three's Campaign, approved by the Retailer only after generation
const UNRESERVED_PAID = [0, 1, 7, 9, 10, 11];

const SELECTION = [{
    retailer_id: 'retailer-one',
    store_id: 'store-one',
    location_id: 'store-one-entrance',
    screen_id: 'store-one-screen',
}];

let deviceKey;

async function seedStore() {
    await retailerRepository.create('retailer-one', { name: 'Northwind Cafés', status: 'active' });
    await StoreRepository.create('store-one', {
        name: 'Northwind Downtown', retailer_id: 'retailer-one', status: 'active', time_zone: 'America/Toronto',
    });
    await locationRepository.create('store-one-entrance', {
        name: 'Entrance', store_id: 'store-one', retailer_id: 'retailer-one', status: 'active',
    });
    const credential = deviceCredentialService.newCredential();
    deviceKey = credential.deviceKey;
    await screenRepository.create('store-one-screen', {
        ...credential.fields,
        name: 'Entrance Screen', store_id: 'store-one', location_id: 'store-one-entrance',
        retailer_id: 'retailer-one', status: 'ONLINE',
    });
    await BusinessHoursRepository.create(`def_store-one_${MONDAY}`, {
        store_id: 'store-one', day_of_week: MONDAY, is_closed: false, open_time: '08:00', close_time: '10:00',
    });
}

const approvedMedia = fields => ({ approval_status: 'approved', eligible_for_playback: true, status: 'ready', ...fields });

async function seedMedia() {
    await mediaRepository.create('fallback-media', approvedMedia({
        title: 'Neutral fallback', category: 'fallback', content_kind: 'neutral_fallback',
        owner_type: 'platform', owner_id: null,
    }));
    await mediaRepository.create('retailer-media', approvedMedia({
        title: 'Breakfast promotion', category: 'retailer', owner_type: 'retailer', owner_id: 'retailer-one',
    }));
    await mediaRepository.create('internal-media', approvedMedia({
        title: 'Softomedia house ad', category: 'internal', owner_type: 'platform', owner_id: null,
    }));
    // Creative approval is seeded: granting it is a separate ticket.
    await seedCreative('brand-one', 'Brand One latte', 'approved');
    await seedCreative('brand-two', 'Brand Two muffin', 'pending');
    await seedCreative('brand-three', 'Brand Three bagel', 'approved');
}

/** A Brand's paid file, and the Creative whose status decides whether it plays. */
async function seedCreative(brandId, title, approvalStatus, fileFields = {}) {
    const mediaId = `${brandId}-file`;
    await creativeRepository.create(`crv-${brandId}`, {
        brand_id: brandId, media_ids: [mediaId], approval_status: approvalStatus,
    });
    await mediaRepository.create(mediaId, {
        title, category: 'paid', owner_type: 'brand', owner_id: brandId, status: 'ready',
        mime_type: 'image/png', duration: 5, creative_id: `crv-${brandId}`, ...fileFields,
    });
}

/** Moves the clock and signs everyone in afresh, so their tokens are valid at the new time. */
async function signInAllAt(now) {
    jest.setSystemTime(now);
    const headersFor = async (role, organizationId = null) =>
        (await signInAs(role, { organizationId, fakeClock: true })).headers;
    return {
        brand: await headersFor('brand', 'brand-one'),
        brandTwo: await headersFor('brand', 'brand-two'),
        brandThree: await headersFor('brand', 'brand-three'),
        retailer: await headersFor('retaileradmin', 'retailer-one'),
        admin: await headersFor('admin'),
    };
}

const book = (headers, brandId, position) => request(app).post('/api/campaigns').set(headers).send({
    name: `${brandId} breakfast`,
    media_id: `${brandId}-file`,
    start_date: DATE,
    end_date: DATE,
    budget: 100,
    inventory_selection: SELECTION,
    slots: [{ store_id: 'store-one', date: DATE, hour: 8, position }],
});

const device = () => `Device store-one-screen:${deviceKey}`;

const proofOfPlay = (loopId, slot, eventId) => request(app)
    .post('/api/device/proof-of-play')
    .set('Authorization', device())
    .send({
        event_id: eventId,
        screen_id: 'store-one-screen',
        location_id: 'store-one-entrance',
        loop_id: loopId,
        slot_position: slot.position,
        campaign_id: slot.campaign_id,
        asset_id: slot.asset_id,
        presentation_started_at: new Date(PLAYING.getTime() - 1_000).toISOString(),
        intended_duration_seconds: 5,
    });

describeWithAuthEmulator('Reserved Slots on the Screen', () => {
    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({ now: BOOKED, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
        await seedStore();
        await seedMedia();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('book → generate → the Screen plays the reserved Creative in its exact Slot → Proof of Play', async () => {
        // Book.
        let as = await signInAllAt(BOOKED);
        const booked = await book(as.brand, 'brand-one', RESERVED);
        const unapprovedCreative = await book(as.brandTwo, 'brand-two', UNAPPROVED_CREATIVE);
        const lateApproval = await book(as.brandThree, 'brand-three', LATE_APPROVAL);
        expect([booked.status, unapprovedCreative.status, lateApproval.status]).toEqual([201, 201, 201]);
        for (const campaign of [booked, unapprovedCreative]) {
            const approval = await request(app).patch(`/api/campaigns/${campaign.body.id}/status`)
                .set(as.retailer).send({ status: 'approved' });
            expect(approval.status).toBe(200);
        }

        // Generate.
        as = await signInAllAt(GENERATED);
        const generated = await request(app).post('/api/loops/generate').set(as.admin)
            .send({ targetDate: DATE, retailerId: 'retailer-one', storeId: 'store-one' });
        expect(generated.status).toBe(201);
        const eightAm = generated.body.loops.find(loop => loop.hour === 8);
        const slotAt = position => eightAm.slots[position];

        expect(slotAt(RESERVED)).toMatchObject({
            allocated_category: 'paid', content_kind: 'campaign', is_fallback: false,
            campaign_id: booked.body.id, asset_id: 'brand-one-file',
        });
        // A Reservation is placed when its Creative is approved; its Campaign's approval is checked at play time.
        expect(slotAt(LATE_APPROVAL)).toMatchObject({
            content_kind: 'campaign', campaign_id: lateApproval.body.id, asset_id: 'brand-three-file',
        });
        for (const position of [UNAPPROVED_CREATIVE, ...UNRESERVED_PAID]) {
            expect({ position, slot: slotAt(position) }).toMatchObject({
                position,
                slot: {
                    allocated_category: 'paid', content_kind: 'fallback', is_fallback: true,
                    campaign_id: null, asset_id: 'fallback-media',
                },
            });
        }
        // Retailer and Internal positions are filled as before.
        expect(slotAt(2)).toMatchObject({ allocated_category: 'retailer', asset_id: 'retailer-media' });
        expect(slotAt(5)).toMatchObject({ allocated_category: 'internal', asset_id: 'internal-media' });
        // A Reservation plays only in its own hour.
        const nineAm = generated.body.loops.find(loop => loop.hour === 9);
        expect(nineAm.slots.filter(slot => slot.campaign_id)).toEqual([]);

        // The Retailer approves the hour.
        as = await signInAllAt(APPROVED);
        const loopApproval = await request(app).patch(`/api/loops/${eightAm.id}/approve`).set(as.retailer);
        expect(loopApproval.status).toBe(200);

        // The Screen plays.
        as = await signInAllAt(PLAYING);
        const playback = await request(app).get('/api/device/playback').set('Authorization', device());
        expect(playback.status).toBe(200);
        expect(playback.body).toMatchObject({ broadcast_date: DATE, hour: 8, loop_id: eightAm.id });
        const played = playback.body.slots;
        expect(played[RESERVED]).toMatchObject({
            presentation_type: 'campaign', counts_as_delivery: true,
            campaign_id: booked.body.id, asset_id: 'brand-one-file',
        });
        for (const position of [UNAPPROVED_CREATIVE, LATE_APPROVAL, ...UNRESERVED_PAID]) {
            expect({ position, presentation_type: played[position].presentation_type, counts: played[position].counts_as_delivery })
                .toEqual({ position, presentation_type: 'fallback', counts: false });
        }

        // Once the Retailer approves Brand Three's Campaign, its already-generated Slot plays.
        const approvedLate = await request(app).patch(`/api/campaigns/${lateApproval.body.id}/status`)
            .set(as.retailer).send({ status: 'approved' });
        expect(approvedLate.status).toBe(200);
        const replayed = await request(app).get('/api/device/playback').set('Authorization', device());
        expect(replayed.body.slots[LATE_APPROVAL]).toMatchObject({
            presentation_type: 'campaign', campaign_id: lateApproval.body.id, asset_id: 'brand-three-file',
        });

        // Proof of Play is recorded for the reserved play, and never for Fallback Content.
        const reported = await proofOfPlay(eightAm.id, played[RESERVED], 'reserved-play');
        expect(reported.status).toBe(201);
        const fallbackClaim = await proofOfPlay(eightAm.id, {
            position: UNAPPROVED_CREATIVE, campaign_id: unapprovedCreative.body.id, asset_id: 'brand-two-file',
        }, 'fallback-play');
        expect(fallbackClaim.status).toBe(422);
        expect(fallbackClaim.body.error).toBe('The presented Slot is not Campaign delivery');

        const proofs = await request(app).get(`/api/campaigns/${booked.body.id}/proofs-of-play`).set(as.brand);
        expect(proofs.status).toBe(200);
        expect(proofs.body).toEqual([expect.objectContaining({
            event_id: 'reserved-play', campaign_id: booked.body.id, asset_id: 'brand-one-file',
            loop_id: eightAm.id, slot_position: RESERVED,
        })]);
        const recorded = await impressionRepository.findAll();
        expect(recorded.map(proof => proof.event_id)).toEqual(['reserved-play']);
    });

    test('a reserved file plays only once its Creative is approved, whatever the file record says', async () => {
        // A file marked approved on its own record, but whose Creative is pending.
        await seedCreative('brand-four', 'Brand Four scone', 'pending', {
            approval_status: 'approved', eligible_for_playback: true,
        });
        // A file marked approved with no Creative at all.
        await mediaRepository.create('brand-five-file', approvedMedia({
            title: 'Brand Five tea', category: 'paid', owner_type: 'brand', owner_id: 'brand-five',
            mime_type: 'image/png', duration: 5,
        }));

        let as = await signInAllAt(BOOKED);
        const brandFour = await signInAs('brand', { organizationId: 'brand-four', fakeClock: true });
        const brandFive = await signInAs('brand', { organizationId: 'brand-five', fakeClock: true });
        const pendingCreative = await book(brandFour.headers, 'brand-four', UNAPPROVED_CREATIVE);
        const noCreative = await book(brandFive.headers, 'brand-five', LATE_APPROVAL);
        expect([pendingCreative.status, noCreative.status]).toEqual([201, 201]);

        const generate = async () => {
            as = await signInAllAt(GENERATED);
            const generated = await request(app).post('/api/loops/generate').set(as.admin)
                .send({ targetDate: DATE, retailerId: 'retailer-one', storeId: 'store-one' });
            expect(generated.status).toBe(201);
            return generated.body.loops.find(loop => loop.hour === 8).slots;
        };

        let slots = await generate();
        for (const position of [UNAPPROVED_CREATIVE, LATE_APPROVAL]) {
            expect({ position, slot: slots[position] }).toMatchObject({
                position, slot: { is_fallback: true, asset_id: 'fallback-media', campaign_id: null },
            });
        }
        // Nor will the Screen fetch the file of an unapproved Creative.
        const media = await request(app).get('/api/device/media/brand-four-file').set('Authorization', device());
        expect(media.status).toBe(404);

        // Once the Creative is approved, its reserved Slot is placed.
        await creativeRepository.update('crv-brand-four', { approval_status: 'approved' });
        slots = await generate();
        expect(slots[UNAPPROVED_CREATIVE]).toMatchObject({
            is_fallback: false, campaign_id: pendingCreative.body.id, asset_id: 'brand-four-file',
        });
        expect(slots[LATE_APPROVAL]).toMatchObject({ is_fallback: true });
    });

    test('Paid positions are never shared out among approved Paid Campaigns without a Reservation', async () => {
        const as = await signInAllAt(GENERATED);
        await campaignRepository.create('unreserved-campaign', {
            type: 'paid', status: 'approved', media_id: 'brand-one-file', brand_id: 'brand-one',
            advertiser_id: 'brand-one', inventory_selection: SELECTION, start_date: DATE, end_date: DATE,
        });

        const generated = await request(app).post('/api/loops/generate').set(as.admin)
            .send({ targetDate: DATE, retailerId: 'retailer-one', storeId: 'store-one' });

        expect(generated.status).toBe(201);
        const paid = generated.body.loops.flatMap(loop => loop.slots)
            .filter(slot => slot.allocated_category === 'paid');
        expect(paid.length).toBeGreaterThan(0);
        expect(paid.every(slot => slot.is_fallback && slot.asset_id === 'fallback-media')).toBe(true);
    });
});
