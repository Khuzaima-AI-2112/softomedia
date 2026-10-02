import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { failStorage, FULL_HOURLY_LOOP } from './fixtures/storage-failure.js';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

const FUTURE = '2035-04-10';

/**
 * Reading, injecting, generating and correcting Hourly Loops, through the whole
 * server and saved in Firestore. Nobody approves an Hourly Loop (ADR 0007).
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

        test('Hourly Loops are filtered by Retailer, Store, Location and Screen', async () => {
            const response = await request(app).get('/api/loops').query({
                retailer_id: retailerId, store_id: storeId, location_id: 'another-location',
                screen_id: 'another-screen',
            }).set(as.admin);

            expect(response.status).toBe(200);
            expect(response.body.loops.map(loop => loop.id)).toEqual([`loop-elsewhere-${suffix}`]);
            expect(response.body.business_hours).toEqual({ start: 8, end: 22, is_closed: false, total_loops: 14 });
        });

        test('a Retailer Administrator reads only their own Retailer\'s Hourly Loops', async () => {
            const own = await request(app).get('/api/loops').set(as.retailer);
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

        test('a storage failure answers 500', async () => {
            failStorage(loopRepository, 'findAll');
            expect((await request(app).get('/api/loops').set(as.admin)).status).toBe(500);
            const preview = await request(app).get(`/api/loops/review/${storeId}/${FUTURE}`).set(as.retailer);
            expect(preview.status).toBe(500);
            expect(preview.body).toEqual({ error: 'Failed to fetch schedule' });
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
            expect(injected.body).toEqual(expect.objectContaining({ id, version: 1 }));
            expect(injected.body).not.toHaveProperty('status');

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

    describe('correcting Hourly Loops', () => {
        test('a Slot position outside the Hourly Loop is refused and changes nothing', async () => {
            const id = await createLoop('bad-position', { hour: 19 });
            const before = (await firestore.collection('loops').doc(id).get()).data();

            for (const position of ['-1', '12', 'abc', '1.5', '3abc']) {
                const replaced = await request(app).patch(`/api/loops/${id}/slots/${position}/replace`)
                    .set(as.admin).send({ assetId: 'new-asset' });
                expect(replaced.status).toBe(400);
                expect(replaced.body).toEqual({ error: `Invalid slot position: ${position}` });
            }

            expect((await firestore.collection('loops').doc(id).get()).data()).toEqual(before);
            const audits = await firestore.collection('scheduling_audits').where('entity_id', '==', id).get();
            expect(audits.empty).toBe(true);
        });

        test('an Admin replaces a Slot in the loop that plays, even one approved before #70', async () => {
            const generated = await createLoop('replace', { hour: 16 });
            const approved = await createLoop('replace-approved', { hour: 17, status: 'approved' });

            expect((await request(app).patch(`/api/loops/${generated}/slots/2/replace`).set(as.admin).send({})).status).toBe(400);
            expect((await request(app).patch(`/api/loops/${generated}/slots/2/replace`).set(as.retailer)
                .send({ assetId: 'new' })).status).toBe(403);

            for (const id of [generated, approved]) {
                const replaced = await request(app).patch(`/api/loops/${id}/slots/2/replace`).set(as.admin).send({ assetId: 'new-asset' });
                expect(replaced.status).toBe(200);
                expect(replaced.body.id).toBe(id);
                expect(replaced.body.slots[2]).toEqual(expect.objectContaining({ asset_id: 'new-asset', status: 'replaced' }));
            }
            expect((await firestore.collection('loops').doc(`${approved}_v2`).get()).exists).toBe(false);
        });

        test('a storage failure answers 500', async () => {
            const id = await createLoop('fragile', { hour: 18 });
            failStorage(loopRepository, 'update');

            expect((await request(app).patch(`/api/loops/${id}/slots/0/replace`).set(as.admin).send({ assetId: 'x' })).status).toBe(500);
        });
    });
});
