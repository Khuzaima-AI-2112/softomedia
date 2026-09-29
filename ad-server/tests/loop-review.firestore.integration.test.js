import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { failStorage, FULL_HOURLY_LOOP } from './fixtures/storage-failure.js';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

// A broadcast date far enough ahead that its Approval Window is open, and one
// whose broadcast has long started.
const FUTURE = '2035-04-10';
const PAST = '2020-01-06';

/**
 * Reading, injecting, generating and reviewing Hourly Loops, through the whole
 * server and saved in Firestore.
 */
describeWithEmulators('Hourly Loop review', () => {
    const suffix = Date.now();
    const retailerId = `loop-retailer-${suffix}`;
    const otherRetailerId = `loop-other-${suffix}`;
    const storeId = `loop-store-${suffix}`;
    const otherStoreId = `loop-other-store-${suffix}`;
    const created = { stores: [storeId, otherStoreId], loops: [] };
    let request;
    let app;
    let firestore;
    let as;
    let loopRepository;
    let loopGenerationService;


    async function createLoop(name, fields = {}) {
        const id = `loop-${name}-${suffix}`;
        created.loops.push(id);
        await loopRepository.create(id, {
            retailer_id: retailerId, store_id: storeId, location_id: `loop-loc-${suffix}`, screen_id: `loop-screen-${suffix}`,
            date: FUTURE, hour: 9, slots: FULL_HOURLY_LOOP, ...fields,
        });
        return id;
    }

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        ({ default: app } = await import('../index.js'));
        ({ loopRepository } = await import('../src/repositories/LoopRepository.js'));
        ({ loopGenerationService } = await import('../src/services/LoopGenerationService.js'));
        const { default: StoreRepository } = await import('../src/repositories/StoreRepository.js');
        await StoreRepository.create(storeId, {
            name: 'Northwind Downtown', retailer_id: retailerId, time_zone: 'America/Toronto', status: 'active',
        });
        await StoreRepository.create(otherStoreId, {
            name: 'Elsewhere', retailer_id: otherRetailerId, time_zone: 'America/Toronto', status: 'active',
        });
        const { signInAs } = await import('./fixtures/emulator-sign-in.js');
        as = {
            superadmin: (await signInAs('superadmin')).headers,
            admin: (await signInAs('admin')).headers,
            retailer: (await signInAs('retaileradmin', { organizationId: retailerId })).headers,
            otherRetailer: (await signInAs('retaileradmin', { organizationId: otherRetailerId })).headers,
            brand: (await signInAs('brand', { organizationId: `loop-brand-${suffix}` })).headers,
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await Promise.all(Object.entries(created).flatMap(([collection, ids]) =>
            ids.map(id => firestore.collection(collection).doc(id).delete())));
    });

    describe('reading Hourly Loops', () => {
        let listed;
        let foreign;

        beforeAll(async () => {
            listed = await createLoop('listed', { hour: 10 });
            await createLoop('elsewhere', { hour: 11, location_id: 'another-location', screen_id: 'another-screen' });
            foreign = await createLoop('foreign', { retailer_id: otherRetailerId, store_id: otherStoreId });
        });

        test('a day\'s Hourly Loops for a Store come with that Store\'s broadcast hours', async () => {
            const response = await request(app).get('/api/loops')
                .query({ date: FUTURE, store_id: storeId, location_id: `loop-loc-${suffix}`, screenid: `loop-screen-${suffix}` })
                .set(as.admin);

            expect(response.status).toBe(200);
            expect(response.body.loops.map(loop => loop.id)).toEqual(expect.arrayContaining([listed]));
            expect(response.body.loops.every(loop => loop.location_id === `loop-loc-${suffix}`)).toBe(true);
            expect(response.body.business_hours).toEqual(expect.objectContaining({ is_closed: expect.any(Boolean) }));
        });

        test('Hourly Loops are filtered by Retailer, Store, Location, Screen and status', async () => {
            const response = await request(app).get('/api/loops').query({
                retailer_id: retailerId, store_id: storeId, location_id: 'another-location',
                screen_id: 'another-screen', status: 'pending_approval',
            }).set(as.admin);

            expect(response.status).toBe(200);
            expect(response.body.loops.map(loop => loop.id)).toEqual([`loop-elsewhere-${suffix}`]);
            expect(response.body.business_hours).toEqual({ start: 8, end: 22, is_closed: false, total_loops: 14 });
        });

        test('a Retailer Administrator reads only their own Retailer\'s Hourly Loops', async () => {
            const own = await request(app).get('/api/loops').query({ status: 'pending_approval' }).set(as.retailer);
            expect(own.status).toBe(200);
            expect(own.body.loops.length).toBeGreaterThan(0);
            expect(own.body.loops.every(loop => loop.retailer_id === retailerId)).toBe(true);

            expect((await request(app).get('/api/loops').query({ retailer_id: otherRetailerId }).set(as.retailer)).status).toBe(403);
            expect((await request(app).get('/api/loops').query({ store_id: otherStoreId }).set(as.retailer)).status).toBe(403);
            expect((await request(app).get('/api/loops').set(as.brand)).status).toBe(403);
        });

        test('one Hourly Loop is read with its Screen count', async () => {
            const response = await request(app).get(`/api/loops/${listed}`).set(as.retailer);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({ id: listed, screen_count: 1 }));

            expect((await request(app).get(`/api/loops/${foreign}`).set(as.retailer)).status).toBe(403);
            expect((await request(app).get(`/api/loops/missing-${suffix}`).set(as.admin)).status).toBe(404);
        });

        test('a Retailer Administrator lists their own pending Hourly Loops only', async () => {
            const own = await request(app).get(`/api/loops/pending/${retailerId}`).set(as.retailer);
            expect(own.status).toBe(200);
            expect(own.body.count).toBe(own.body.loops.length);
            expect(own.body.loops.every(loop => loop.status === 'pending_approval' && loop.retailer_id === retailerId)).toBe(true);

            expect((await request(app).get(`/api/loops/pending/${otherRetailerId}`).set(as.retailer)).status).toBe(403);
        });

        test('a storage failure answers 500', async () => {
            failStorage(loopRepository, 'findAll');
            expect((await request(app).get('/api/loops').set(as.admin)).status).toBe(500);
            expect((await request(app).get(`/api/loops/pending/${retailerId}`).set(as.retailer)).status).toBe(500);
            const review = await request(app).get(`/api/loops/review/${storeId}/${FUTURE}`).set(as.retailer);
            expect(review.status).toBe(500);
            expect(review.body).toEqual({ error: 'Approval operation failed' });
            failStorage(loopRepository, 'findById');
            expect((await request(app).get(`/api/loops/${listed}`).set(as.admin)).status).toBe(500);
        });
    });

    describe('injecting and generating Hourly Loops', () => {
        test('the Super Administrator injects an Hourly Loop under a chosen ID, once', async () => {
            const id = `loop-injected-${suffix}`;
            created.loops.push(id);
            const body = { id, retailer_id: retailerId, store_id: storeId, date: FUTURE, hour: 12, slots: FULL_HOURLY_LOOP };

            const injected = await request(app).post('/api/loops').set(as.superadmin).send(body);
            expect(injected.status).toBe(201);
            expect(injected.body).toEqual(expect.objectContaining({ id, status: 'pending_approval', version: 1 }));

            expect((await request(app).post('/api/loops').set(as.superadmin).send(body)).status).toBe(409);
            expect((await request(app).post('/api/loops').set(as.admin).send(body)).status).toBe(403);
        });

        test('a storage failure while injecting an Hourly Loop answers 500', async () => {
            failStorage(loopRepository, 'create');

            const response = await request(app).post('/api/loops').set(as.superadmin)
                .send({ id: `loop-fragile-inject-${suffix}`, date: FUTURE, hour: 12 });

            expect(response.status).toBe(500);
        });

        test('generation needs a date, a Retailer and a Store', async () => {
            const response = await request(app).post('/api/loops/generate').set(as.admin).send({ targetDate: FUTURE });

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Missing required fields: targetDate, retailerId, storeId' });
        });

        test('a generated Hourly Loop that is not twelve five-second Slots is refused', async () => {
            const body = { targetDate: FUTURE, retailerId, storeId };
            const operatingHours = { start: 9, end: 10, is_closed: false };
            const generate = loops => jest.spyOn(loopGenerationService, 'generateDailySchedule')
                .mockResolvedValue({ loops, operatingHours });

            generate([{ id: 'short', slots: FULL_HOURLY_LOOP.slice(1) }]);
            const short = await request(app).post('/api/loops/generate').set(as.admin).send(body);
            expect(short.status).toBe(400);
            expect(short.body.error).toBe('Invariant Violation: Loop short does not contain exactly 12 ads.');

            generate([{ id: 'long', slots: FULL_HOURLY_LOOP.map(slot => ({ ...slot, duration: 6 })) }]);
            const long = await request(app).post('/api/loops/generate').set(as.admin).send(body);
            expect(long.status).toBe(400);
            expect(long.body.error).toBe('Invariant Violation: Loop long duration is 72s instead of the strict 60s.');

            failStorage(loopGenerationService, 'generateDailySchedule');
            expect((await request(app).post('/api/loops/generate').set(as.admin).send(body)).status).toBe(500);
        });
    });

    describe('reviewing Hourly Loops', () => {
        test('reopening an Approval Window is for the Admin or Super Administrator, with a reason', async () => {
            const url = `/api/loops/review/${storeId}/${PAST}/reopen`;
            expect((await request(app).post(url).set(as.retailer).send({ reason: 'Late' })).status).toBe(403);
            expect((await request(app).post(`/api/loops/review/missing-${suffix}/${PAST}/reopen`).set(as.admin)
                .send({ reason: 'Late' })).status).toBe(403);

            const noReason = await request(app).post(url).set(as.admin).send({ expires_at: '2020-01-06T12:00' });
            expect(noReason.status).toBe(400);
            expect(noReason.body).toEqual({ error: 'Reason is required' });
        });

        test('a rejected Hourly Loop records who rejected it and why', async () => {
            const id = await createLoop('rejected', { hour: 13 });

            expect((await request(app).post(`/api/loops/${id}/reject`).set(as.retailer).send({ reason: ' ' })).status).toBe(400);
            expect((await request(app).post(`/api/loops/${id}/reject`).set(as.otherRetailer).send({ reason: 'No' })).status).toBe(403);

            const rejected = await request(app).post(`/api/loops/${id}/reject`).set(as.retailer).send({ reason: ' Off-brand ' });
            expect(rejected.status).toBe(200);
            expect(rejected.body).toEqual(expect.objectContaining({
                status: 'rejected', rejection_reason: 'Off-brand', rejected_at: expect.any(String), rejected_by: expect.any(String),
            }));
            expect((await firestore.collection('loops').doc(id).get()).data().status).toBe('rejected');
        });

        test('an approved Hourly Loop cannot be approved again', async () => {
            const id = await createLoop('approved', { hour: 14 });

            const approved = await request(app).patch(`/api/loops/${id}/approve`).set(as.retailer);
            expect(approved.status).toBe(200);
            expect(approved.body).toEqual(expect.objectContaining({ status: 'approved', approved_by: expect.any(String) }));

            const again = await request(app).patch(`/api/loops/${id}/approve`).set(as.retailer);
            expect(again.status).toBe(400);
            expect(again.body.error).toContain('cannot be approved from status: approved');
        });

        test('a rejected Slot asks for a replacement', async () => {
            const id = await createLoop('slot', { hour: 15 });
            const url = `/api/loops/${id}/slots/3/reject`;

            expect((await request(app).patch(url).set(as.retailer).send({})).status).toBe(400);
            const rejected = await request(app).patch(url).set(as.retailer).send({ reason: 'Blurry' });
            expect(rejected.status).toBe(200);
            expect(rejected.body.status).toBe('replacement_requested');
            expect(rejected.body.slots[3]).toEqual(expect.objectContaining({ status: 'rejected', rejection_reason: 'Blurry' }));
        });

        test('a Slot position outside the Hourly Loop is refused and changes nothing', async () => {
            const id = await createLoop('bad-position', { hour: 19 });
            const approved = await createLoop('bad-position-approved', { hour: 20, status: 'approved' });
            const before = (await firestore.collection('loops').doc(id).get()).data();
            const approvedBefore = (await firestore.collection('loops').doc(approved).get()).data();

            for (const position of ['-1', '12', 'abc', '1.5', '3abc']) {
                const rejected = await request(app).patch(`/api/loops/${id}/slots/${position}/reject`)
                    .set(as.retailer).send({ reason: 'Blurry' });
                expect(rejected.status).toBe(400);
                expect(rejected.body).toEqual({ error: `Invalid slot position: ${position}` });

                const replaced = await request(app).patch(`/api/loops/${id}/slots/${position}/replace`)
                    .set(as.admin).send({ assetId: 'new-asset' });
                expect(replaced.status).toBe(400);
                expect(replaced.body).toEqual({ error: `Invalid slot position: ${position}` });

                const versioned = await request(app).patch(`/api/loops/${approved}/slots/${position}/replace`)
                    .set(as.admin).send({ assetId: 'new-asset' });
                expect(versioned.status).toBe(400);
            }

            expect((await firestore.collection('loops').doc(id).get()).data()).toEqual(before);
            expect((await firestore.collection('loops').doc(approved).get()).data()).toEqual(approvedBefore);
            expect((await firestore.collection('loops').doc(`${approved}_v2`).get()).exists).toBe(false);
            const audits = await firestore.collection('scheduling_audits')
                .where('entity_id', 'in', [id, approved, `${approved}_v2`]).get();
            expect(audits.empty).toBe(true);
        });

        test('an Hourly Loop whose broadcast has started can no longer be reviewed', async () => {
            const id = await createLoop('started', { date: PAST });

            expect((await request(app).patch(`/api/loops/${id}/approve`).set(as.retailer)).status).toBe(409);
            expect((await request(app).post(`/api/loops/${id}/reject`).set(as.retailer).send({ reason: 'Late' })).status).toBe(409);
            expect((await request(app).patch(`/api/loops/${id}/slots/0/reject`).set(as.retailer).send({ reason: 'Late' })).status).toBe(409);
        });

        test('an Hourly Loop without a Store cannot be reviewed', async () => {
            const id = await createLoop('storeless', { store_id: `missing-store-${suffix}` });
            const conflict = { error: 'Loop is not assigned to a Store' };

            expect((await request(app).patch(`/api/loops/${id}/approve`).set(as.retailer)).body).toEqual(conflict);
            expect((await request(app).post(`/api/loops/${id}/reject`).set(as.retailer).send({ reason: 'x' })).body).toEqual(conflict);
            expect((await request(app).patch(`/api/loops/${id}/slots/0/reject`).set(as.retailer).send({ reason: 'x' })).body).toEqual(conflict);
        });

        test('an Admin replaces a Slot in place, or in a new version of an approved Hourly Loop', async () => {
            const pending = await createLoop('replace', { hour: 16 });
            const approved = await createLoop('replace-approved', { hour: 17, status: 'approved' });
            created.loops.push(`${approved}_v2`);

            expect((await request(app).patch(`/api/loops/${pending}/slots/2/replace`).set(as.admin).send({})).status).toBe(400);
            expect((await request(app).patch(`/api/loops/${pending}/slots/2/replace`).set(as.retailer)
                .send({ assetId: 'new' })).status).toBe(403);

            const inPlace = await request(app).patch(`/api/loops/${pending}/slots/2/replace`).set(as.admin).send({ assetId: 'new-asset' });
            expect(inPlace.status).toBe(200);
            expect(inPlace.body.id).toBe(pending);
            expect(inPlace.body.slots[2]).toEqual(expect.objectContaining({ asset_id: 'new-asset', status: 'replaced' }));

            const versioned = await request(app).patch(`/api/loops/${approved}/slots/2/replace`).set(as.admin).send({ assetId: 'new-asset' });
            expect(versioned.status).toBe(200);
            expect(versioned.body).toEqual(expect.objectContaining({
                id: `${approved}_v2`, parentLoopId: approved, version: 2, status: 'pending_approval',
            }));
            expect((await firestore.collection('loops').doc(approved).get()).data().status).toBe('approved');
        });

        test('a storage failure answers 500', async () => {
            const id = await createLoop('fragile', { hour: 18 });
            failStorage(loopRepository, 'update');

            expect((await request(app).post(`/api/loops/${id}/reject`).set(as.retailer).send({ reason: 'x' })).status).toBe(500);
            expect((await request(app).patch(`/api/loops/${id}/approve`).set(as.retailer)).status).toBe(500);
            expect((await request(app).patch(`/api/loops/${id}/slots/0/reject`).set(as.retailer).send({ reason: 'x' })).status).toBe(500);
            expect((await request(app).patch(`/api/loops/${id}/slots/0/replace`).set(as.admin).send({ assetId: 'x' })).status).toBe(500);
        });
    });
});
