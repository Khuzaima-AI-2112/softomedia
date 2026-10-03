import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { retailerApprovals } from './fixtures/creative-approval.js';

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
const { slotReservationRepository } = await import('../src/repositories/SlotReservationRepository.js');
const { deviceCredentialService } = await import('../src/services/DeviceCredentialService.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');
const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

// Broadcast date D is Monday 2030-01-07 in Toronto (EST, UTC-5). The Store opens
// at 08:00, so its Slots follow the allocation pattern from the day's first position:
//   08:00  P P R P P I P P R P P P   → 2-Slot runs start at 0, 3, 6, 9, 10; a 3-Slot run at 9
//   09:00  R P P I P P R P P P R P   → 2-Slot runs start at 1, 4, 7, 8; a 3-Slot run at 7
const DATE = '2030-01-07';
const MONDAY = 1;
const BOOKED = new Date('2030-01-01T12:00:00.000Z');
const GENERATED = new Date('2030-01-05T14:00:00.000Z');
const PLAYING = new Date('2030-01-07T13:00:30.000Z'); // 08:00:30 in Toronto

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
    await mediaRepository.create('fallback-media', {
        title: 'Neutral fallback', category: 'fallback', content_kind: 'neutral_fallback',
        owner_type: 'platform', owner_id: null, approval_status: 'approved', eligible_for_playback: true,
        status: 'ready',
    });
}

/** A Brand's Creative of `files` five-second files, in order: `<id>-part-1`, `<id>-part-2`, … */
async function seedCreative(id, brandId, files, approvalStatus = 'approved') {
    const mediaIds = Array.from({ length: files }, (_, index) => `${id}-part-${index + 1}`);
    await creativeRepository.create(id, {
        brand_id: brandId, media_ids: mediaIds, approval_status: approvalStatus,
        retailer_approvals: retailerApprovals('retailer-one'),
    });
    for (const [index, mediaId] of mediaIds.entries()) {
        await mediaRepository.create(mediaId, {
            title: `${id} part ${index + 1}`, category: 'paid', owner_type: 'brand', owner_id: brandId,
            status: 'ready', mime_type: 'image/png', duration: 5, creative_id: id,
        });
    }
    return mediaIds;
}

const slot = (hour, position) => ({ store_id: 'store-one', date: DATE, hour, position });

const book = (headers, mediaId, slots) => request(app).post('/api/campaigns').set(headers).send({
    name: 'Two-part breakfast',
    media_id: mediaId,
    start_date: DATE,
    end_date: DATE,
    budget: 100,
    inventory_selection: SELECTION,
    slots,
});

const availability = (headers, files) => request(app)
    .get(`/api/inventory/stores/store-one/slots?date=${DATE}${files === undefined ? '' : `&files=${files}`}`)
    .set(headers);

/** Generates the Store's Hourly Loops as Admin and returns the 08:00 one. */
async function generateEightAm() {
    jest.setSystemTime(GENERATED);
    const admin = (await signInAs('admin', { fakeClock: true })).headers;
    const generated = await request(app).post('/api/loops/generate').set(admin)
        .send({ targetDate: DATE, retailerId: 'retailer-one', storeId: 'store-one' });
    expect(generated.status).toBe(201);
    return generated.body.loops.find(loop => loop.hour === 8);
}

/** Each Slot's Run: where it starts, its length and the Slot's file. */
const runsOf = slots => slots.map(({ run_start: start, run_length: length, run_file: file }) => ({ start, length, file }));

const runsAt = (body, hour) => body.hours.find(candidate => candidate.hour === hour).runs;

const brandAt = async (now, organizationId = 'brand-one') => {
    jest.setSystemTime(now);
    return (await signInAs('brand', { organizationId, fakeClock: true })).headers;
};

describeWithAuthEmulator('Multi-file Creatives in consecutive Paid Slots', () => {
    beforeEach(async () => {
        clearMockStorage();
        jest.useFakeTimers({ now: BOOKED, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
        await seedStore();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('availability offers only free consecutive Paid runs long enough for the Creative', () => {
        test('each hour lists where a run of one, two or three free Paid Slots starts', async () => {
            const brand = await brandAt(BOOKED);

            const single = await availability(brand);
            expect(single.status).toBe(200);
            expect(single.body.run_length).toBe(1);
            expect(runsAt(single.body, 8)).toEqual([0, 1, 3, 4, 6, 7, 9, 10, 11]);

            const pairs = (await availability(brand, 2)).body;
            expect(pairs.run_length).toBe(2);
            expect(runsAt(pairs, 8)).toEqual([0, 3, 6, 9, 10]);
            expect(runsAt(pairs, 9)).toEqual([1, 4, 7, 8]);

            // 15-second runs are rare under the allocation pattern.
            const triples = (await availability(brand, 3)).body;
            expect(runsAt(triples, 8)).toEqual([9]);
            expect(runsAt(triples, 9)).toEqual([7]);
        });

        test('a Slot another Brand holds breaks every run through it', async () => {
            await seedCreative('crv-rival', 'brand-two', 1);
            const rival = await brandAt(BOOKED, 'brand-two');
            expect((await book(rival, 'crv-rival-part-1', [slot(8, 10)])).status).toBe(201);

            const brand = await brandAt(BOOKED);
            expect(runsAt((await availability(brand, 2)).body, 8)).toEqual([0, 3, 6]);
            expect(runsAt((await availability(brand, 3)).body, 8)).toEqual([]);
        });

        test.each(['0', '4', 'two'])('refuses a Creative of %s files', async files => {
            const response = await availability(await brandAt(BOOKED), files);
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('files must be a whole number from 1 to 3');
        });
    });

    describe('a multi-file Creative is booked only into consecutive Paid runs of its length', () => {
        test('picks forming whole runs are reserved', async () => {
            const [first] = await seedCreative('crv-pair', 'brand-one', 2);
            const brand = await brandAt(BOOKED);

            const response = await book(brand, first, [slot(8, 4), slot(8, 3), slot(9, 7), slot(9, 8)]);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({
                media_id: first, creative_id: 'crv-pair', creative_media_ids: ['crv-pair-part-1', 'crv-pair-part-2'],
            });
            expect(await slotReservationRepository.findAll()).toHaveLength(4);
        });

        test('naming a later file of the Creative books the whole Creative', async () => {
            await seedCreative('crv-pair', 'brand-one', 2);
            const brand = await brandAt(BOOKED);

            const response = await book(brand, 'crv-pair-part-2', [slot(8, 0), slot(8, 1)]);

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({ media_id: 'crv-pair-part-1', creative_id: 'crv-pair' });
        });

        test.each([
            ['a lone Slot', [slot(8, 0)]],
            ['Slots split by a Retailer Slot', [slot(8, 1), slot(8, 3)]],
            ['a run with a Slot left over', [slot(8, 9), slot(8, 10), slot(8, 11)]],
            ['a pair split across two hours', [slot(8, 11), slot(9, 1)]],
        ])('%s is refused and nothing is reserved', async (_, slots) => {
            const [first] = await seedCreative('crv-pair', 'brand-one', 2);
            const brand = await brandAt(BOOKED);

            const response = await book(brand, first, slots);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'This Creative has 2 files, so pick its Slots in runs of 2 consecutive Paid Slots in one hour',
                code: 'INVALID_SLOTS',
            });
            expect(await slotReservationRepository.findAll()).toEqual([]);
        });

        test('a three-file Creative takes a run of three', async () => {
            const [first] = await seedCreative('crv-triple', 'brand-one', 3);
            const brand = await brandAt(BOOKED);

            expect((await book(brand, first, [slot(8, 9), slot(8, 10)])).status).toBe(400);
            expect((await book(brand, first, [slot(8, 9), slot(8, 10), slot(8, 11)])).status).toBe(201);
        });
    });

    test('the Screen plays the files in order in consecutive Slots, each with its own Proof of Play', async () => {
        const parts = await seedCreative('crv-triple', 'brand-one', 3);
        let brand = await brandAt(BOOKED);
        const booked = await book(brand, parts[0], [slot(8, 11), slot(8, 9), slot(8, 10)]);
        expect(booked.status).toBe(201);

        const eightAm = await generateEightAm();
        expect(eightAm.slots.slice(9).map(({ asset_id: assetId, campaign_id: campaignId, is_fallback: fallback }) => ({
            assetId, campaignId, fallback,
        }))).toEqual(parts.map(assetId => ({ assetId, campaignId: booked.body.id, fallback: false })));

        // Nobody approves the hour: the Screen plays the generated loop (ADR 0007).
        jest.setSystemTime(PLAYING);
        const device = `Device store-one-screen:${deviceKey}`;
        const playback = await request(app).get('/api/device/playback').set('Authorization', device);
        expect(playback.status).toBe(200);
        const played = playback.body.slots.slice(9);
        expect(played.map(({ asset_id: assetId, presentation_type: type }) => ({ assetId, type })))
            .toEqual(parts.map(assetId => ({ assetId, type: 'campaign' })));

        for (const presented of played) {
            const proof = await request(app).post('/api/device/proof-of-play').set('Authorization', device).send({
                event_id: `play-${presented.position}`,
                screen_id: 'store-one-screen',
                location_id: 'store-one-entrance',
                loop_id: eightAm.id,
                slot_position: presented.position,
                campaign_id: booked.body.id,
                asset_id: presented.asset_id,
                presentation_started_at: new Date(PLAYING.getTime() - 1_000).toISOString(),
                intended_duration_seconds: 5,
            });
            expect(proof.status).toBe(201);
        }

        brand = await brandAt(PLAYING);
        const proofs = await request(app).get(`/api/campaigns/${booked.body.id}/proofs-of-play`).set(brand);
        expect(proofs.status).toBe(200);
        expect(proofs.body.map(({ slot_position: position, asset_id: assetId }) => ({ position, assetId }))
            .sort((a, b) => a.position - b.position))
            .toEqual(parts.map((assetId, index) => ({ position: 9 + index, assetId })));
    });

    test('the delivery report counts a Run\'s three Proofs of Play as 3 Slots and 1 Ad Play', async () => {
        const parts = await seedCreative('crv-triple', 'brand-one', 3);
        let brand = await brandAt(BOOKED);
        const booked = await book(brand, parts[0], [slot(8, 9), slot(8, 10), slot(8, 11)]);
        expect(booked.status).toBe(201);

        const eightAm = await generateEightAm();

        // The Run plays in the hour's first pass, at 08:00:45, 08:00:50 and 08:00:55.
        const HOUR_STARTED = Date.parse('2030-01-07T13:00:00.000Z');
        jest.setSystemTime(HOUR_STARTED + 60_000);
        for (const [file, assetId] of parts.entries()) {
            const position = 9 + file;
            const proof = await request(app).post('/api/device/proof-of-play')
                .set('Authorization', `Device store-one-screen:${deviceKey}`).send({
                    event_id: `play-${position}`,
                    screen_id: 'store-one-screen',
                    location_id: 'store-one-entrance',
                    loop_id: eightAm.id,
                    slot_position: position,
                    campaign_id: booked.body.id,
                    asset_id: assetId,
                    presentation_started_at: new Date(HOUR_STARTED + position * 5_000).toISOString(),
                    intended_duration_seconds: 5,
                });
            expect(proof.status).toBe(201);
        }

        brand = await brandAt(new Date(HOUR_STARTED + 60_000));
        const report = await request(app).get('/api/delivery-report').set(brand);
        expect(report.status).toBe(200);
        expect(report.body.rows.map(({ campaign_id: campaignId, dayparts, total }) => ({
            campaignId, breakfast: dayparts.breakfast, total,
        }))).toEqual([{ campaignId: booked.body.id, breakfast: { slots: 3, ad_plays: 1 }, total: { slots: 3, ad_plays: 1 } }]);
    });

    test('each Slot of a Run records where its Run starts, its length and its file', async () => {
        const [first] = await seedCreative('crv-triple', 'brand-one', 3);
        const brand = await brandAt(BOOKED);
        expect((await book(brand, first, [slot(8, 9), slot(8, 10), slot(8, 11)])).status).toBe(201);

        const eightAm = await generateEightAm();
        expect(runsOf(eightAm.slots.slice(9))).toEqual([
            { start: 9, length: 3, file: 0 },
            { start: 9, length: 3, file: 1 },
            { start: 9, length: 3, file: 2 },
        ]);
    });

    test('a single-file Creative in consecutive Slots makes a separate Run of each Slot', async () => {
        const [only] = await seedCreative('crv-single', 'brand-one', 1);
        const brand = await brandAt(BOOKED);
        expect((await book(brand, only, [slot(8, 9), slot(8, 10), slot(8, 11)])).status).toBe(201);

        const eightAm = await generateEightAm();
        expect(runsOf(eightAm.slots.slice(9))).toEqual([
            { start: 9, length: 1, file: 0 },
            { start: 10, length: 1, file: 0 },
            { start: 11, length: 1, file: 0 },
        ]);
    });

    test('a run no longer whole plays Fallback Content rather than a file out of order', async () => {
        const [first] = await seedCreative('crv-pair', 'brand-one', 2);
        const brand = await brandAt(BOOKED);
        const booked = await book(brand, first, [slot(8, 0), slot(8, 1), slot(8, 3), slot(8, 4)]);
        expect(booked.status).toBe(201);
        // Only one Slot of the second run is still held.
        await slotReservationRepository.delete(slotReservationRepository.idFor(slot(8, 3)));

        const eightAm = await generateEightAm();
        expect([0, 1, 4].map(position => eightAm.slots[position].asset_id))
            .toEqual(['crv-pair-part-1', 'crv-pair-part-2', 'fallback-media']);
    });

    test('an unapproved multi-file Creative plays Fallback Content in every Slot of its run', async () => {
        const [first] = await seedCreative('crv-pair', 'brand-one', 2, 'pending');
        const brand = await brandAt(BOOKED);
        expect((await book(brand, first, [slot(8, 0), slot(8, 1)])).status).toBe(201);

        jest.setSystemTime(GENERATED);
        const admin = (await signInAs('admin', { fakeClock: true })).headers;
        const generated = await request(app).post('/api/loops/generate').set(admin)
            .send({ targetDate: DATE, retailerId: 'retailer-one', storeId: 'store-one' });
        expect(generated.status).toBe(201);

        // Approval is checked when the Slot plays.
        jest.setSystemTime(PLAYING);
        const playback = await request(app).get('/api/device/playback')
            .set('Authorization', `Device store-one-screen:${deviceKey}`);
        expect(playback.body.slots.slice(0, 2).map(({ presentation_type: type, asset_id: assetId }) => ({ type, assetId })))
            .toEqual([{ type: 'fallback', assetId: 'fallback-media' }, { type: 'fallback', assetId: 'fallback-media' }]);
    });
});
