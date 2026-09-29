import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { failStorage, FULL_HOURLY_LOOP } from './fixtures/storage-failure.js';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

/**
 * Setting up the Screen network — Stores, their Locations and the Screens in
 * them — through the whole server and saved in Firestore.
 */
describeWithEmulators('Network setup', () => {
    const suffix = Date.now();
    const retailerId = `net-retailer-${suffix}`;
    const otherRetailerId = `net-other-${suffix}`;
    const storeId = `net-store-${suffix}`;
    const otherStoreId = `net-other-store-${suffix}`;
    const created = { stores: [storeId, otherStoreId], locations: [], screens: [], loops: [] };
    let request;
    let app;
    let firestore;
    let as;
    let repositories;
    let StoreRepository;


    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        ({ default: app } = await import('../index.js'));
        repositories = await import('../src/repositories/index.js');
        ({ default: StoreRepository } = await import('../src/repositories/StoreRepository.js'));
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
            tech: (await signInAs('techoperator')).headers,
            retailer: (await signInAs('retaileradmin', { organizationId: retailerId })).headers,
            unlinkedRetailer: (await signInAs('retaileradmin')).headers,
            brand: (await signInAs('brand', { organizationId: `net-brand-${suffix}` })).headers,
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await Promise.all(Object.entries(created).flatMap(([collection, ids]) =>
            ids.map(id => firestore.collection(collection).doc(id).delete())));
    });

    async function createLocation(name = 'Entrance', store = storeId) {
        const id = `net-loc-${name.toLowerCase()}-${suffix}`;
        const response = await request(app).post('/api/locations').set(as.retailer).send({ id, name, store_id: store });
        created.locations.push(id);
        return response;
    }

    describe('Stores', () => {
        test('a Retailer Administrator lists only their own Stores', async () => {
            const own = await request(app).get('/api/stores').set(as.retailer);
            expect(own.status).toBe(200);
            expect(own.body.map(store => store.id)).toEqual([storeId]);

            expect((await request(app).get(`/api/stores?retailer_id=${otherRetailerId}`).set(as.retailer)).status).toBe(403);
            expect((await request(app).get('/api/stores').set(as.unlinkedRetailer)).status).toBe(403);
            expect((await request(app).get(`/api/stores/${otherStoreId}`).set(as.retailer)).status).toBe(403);
        });

        test('an Admin lists every Store, or one Retailer\'s', async () => {
            const filtered = await request(app).get(`/api/stores?retailer_id=${otherRetailerId}`).set(as.admin);
            expect(filtered.body.map(store => store.id)).toEqual([otherStoreId]);

            const all = await request(app).get('/api/stores').set(as.admin);
            expect(all.body.map(store => store.id)).toEqual(expect.arrayContaining([storeId, otherStoreId]));
        });

        test('a new Store needs a name, a Retailer and a real time zone', async () => {
            const missing = await request(app).post('/api/stores').set(as.admin).send({ name: 'No zone', retailer_id: retailerId });
            expect(missing.status).toBe(400);
            const badZone = await request(app).post('/api/stores').set(as.admin)
                .send({ name: 'Bad zone', retailer_id: retailerId, time_zone: 'Mars/Olympus' });
            expect(badZone.status).toBe(400);
            expect(badZone.body).toEqual({ error: 'time_zone must be a valid IANA time zone' });
        });

        test('a Retailer Administrator cannot add a Store to another Retailer', async () => {
            const response = await request(app).post('/api/stores').set(as.retailer)
                .send({ name: 'Theirs', retailer_id: otherRetailerId, time_zone: 'America/Toronto' });

            expect(response.status).toBe(403);
        });

        test('a new Store opens 08:00–22:00 every day until its hours are changed', async () => {
            const response = await request(app).post('/api/stores').set(as.retailer)
                .send({ name: 'Uptown', retailer_id: retailerId, time_zone: 'America/Toronto' });

            expect(response.status).toBe(201);
            created.stores.push(response.body.id);
            expect(response.body).toEqual(expect.objectContaining({
                name: 'Uptown', store_profile: 'standard', address: '', city: '', state: '', screen_count: 0, status: 'active',
            }));
            const weekly = await request(app).get(`/api/stores/${response.body.id}/weekly-hours`).set(as.retailer);
            expect(weekly.status).toBe(200);
            expect(weekly.body).toHaveLength(7);
            expect(weekly.body.every(day => day.open_time === '08:00' && day.close_time === '22:00')).toBe(true);
        });

        test('a Store is edited in place but never moved to another Retailer', async () => {
            const renamed = await request(app).patch(`/api/stores/${storeId}`).set(as.retailer).send({ address: '1 Main St' });
            expect(renamed.status).toBe(200);
            expect(renamed.body.address).toBe('1 Main St');

            const moved = await request(app).put(`/api/stores/${storeId}`).set(as.retailer).send({ retailer_id: otherRetailerId });
            expect(moved.status).toBe(403);
            const badZone = await request(app).put(`/api/stores/${storeId}`).set(as.retailer).send({ time_zone: 'Nowhere' });
            expect(badZone.status).toBe(400);
            const foreign = await request(app).put(`/api/stores/${otherStoreId}`).set(as.retailer).send({ name: 'Mine now' });
            expect(foreign.status).toBe(403);
        });

        test('only the Super Administrator assigns a CPM traffic tier, and only a configured one', async () => {
            const byAdmin = await request(app).patch(`/api/stores/${storeId}`).set(as.admin).send({ cpm_traffic_tier: 'high' });
            expect(byAdmin.status).toBe(403);

            const unknown = await request(app).patch(`/api/stores/${storeId}`).set(as.superadmin).send({ cpm_traffic_tier: 'legendary' });
            expect(unknown.status).toBe(400);
            expect(unknown.body.error).toMatch(/^cpm_traffic_tier must be null or one of: /);

            const cleared = await request(app).patch(`/api/stores/${storeId}`).set(as.superadmin).send({ cpm_traffic_tier: null });
            expect(cleared.status).toBe(200);
            expect(cleared.body.cpm_traffic_tier).toBeNull();
        });

        test('effective hours need a date', async () => {
            const missing = await request(app).get(`/api/stores/${storeId}/hours`).set(as.retailer);
            expect(missing.status).toBe(400);

            const hours = await request(app).get(`/api/stores/${storeId}/hours?date=2031-03-05`).set(as.retailer);
            expect(hours.status).toBe(200);
        });

        test('special hours need a date and valid times, and are listed once saved', async () => {
            const url = `/api/stores/${storeId}/special-hours`;
            expect((await request(app).put(url).set(as.retailer).send({ is_closed: true })).status).toBe(400);
            const badTimes = await request(app).put(url).set(as.retailer)
                .send({ date: '2031-03-05', is_closed: false, open_time: '20:00', close_time: '09:00' });
            expect(badTimes.status).toBe(400);

            const saved = await request(app).put(url).set(as.retailer).send({ date: '2031-03-05', is_closed: true });
            expect(saved.status).toBe(200);
            const listed = await request(app).get(url).set(as.retailer);
            expect(listed.status).toBe(200);
            expect(listed.body.map(day => day.date)).toContain('2031-03-05');
        });

        test('weekly hours that are not seven valid days are refused', async () => {
            const response = await request(app).put(`/api/stores/${storeId}/weekly-hours`).set(as.retailer)
                .send({ weekly_hours: [{ day_of_week: 9 }] });

            expect(response.status).toBe(400);
        });

        test('a deleted Store is gone', async () => {
            const { body: store } = await request(app).post('/api/stores').set(as.admin)
                .send({ name: 'Closing', retailer_id: retailerId, time_zone: 'America/Toronto' });
            created.stores.push(store.id);

            expect((await request(app).delete(`/api/stores/${store.id}`).set(as.admin)).status).toBe(204);
            expect((await firestore.collection('stores').doc(store.id).get()).exists).toBe(false);
            expect((await request(app).delete(`/api/stores/${otherStoreId}`).set(as.retailer)).status).toBe(403);
        });

        test('a storage failure answers 500 on every Store route', async () => {
            const base = `/api/stores/${storeId}`;
            failStorage(StoreRepository, 'findAll');
            expect((await request(app).get('/api/stores').set(as.admin)).status).toBe(500);
            failStorage(StoreRepository, 'createWithScreens');
            expect((await request(app).post('/api/stores').set(as.admin)
                .send({ name: 'X', retailer_id: retailerId, time_zone: 'America/Toronto' })).status).toBe(500);
            failStorage(StoreRepository, 'update');
            expect((await request(app).patch(base).set(as.admin).send({ name: 'X' })).status).toBe(500);
            failStorage(StoreRepository, 'delete');
            expect((await request(app).delete(base).set(as.admin)).status).toBe(500);
            jest.restoreAllMocks();

            failStorage(StoreRepository, 'findById');
            for (const path of ['', '/hours?date=2031-03-05', '/weekly-hours', '/special-hours']) {
                expect((await request(app).get(`${base}${path}`).set(as.admin)).status).toBe(500);
            }
        });
    });

    describe('Locations', () => {
        test('a Location belongs to the Store it is added to, and lists with the Store\'s time zone', async () => {
            const response = await createLocation('Checkout');

            expect(response.status).toBe(201);
            expect(response.body).toEqual(expect.objectContaining({ name: 'Checkout', store_id: storeId, retailer_id: retailerId }));
            const byStore = await request(app).get(`/api/locations?store_id=${storeId}`).set(as.retailer);
            expect(byStore.status).toBe(200);
            expect(byStore.body).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: response.body.id, time_zone: 'America/Toronto' }),
            ]));
        });

        test('a Retailer Administrator lists only their own Retailer\'s Locations', async () => {
            await createLocation('Patio');
            await request(app).post('/api/locations').set(as.admin)
                .send({ id: `net-loc-foreign-${suffix}`, name: 'Foreign', store_id: otherStoreId });
            created.locations.push(`net-loc-foreign-${suffix}`);

            const own = await request(app).get('/api/locations').set(as.retailer);
            expect(own.body.every(location => location.retailer_id === retailerId)).toBe(true);
            const network = await request(app).get('/api/locations').set(as.admin);
            expect(network.body.map(location => location.id)).toContain(`net-loc-foreign-${suffix}`);
            expect((await request(app).get('/api/locations').set(as.unlinkedRetailer)).status).toBe(403);
            expect((await request(app).get(`/api/locations?store_id=${otherStoreId}`).set(as.retailer)).status).toBe(403);
        });

        test('a Location needs a name and a Store the caller manages', async () => {
            expect((await request(app).post('/api/locations').set(as.retailer).send({ name: 'No store' })).status).toBe(400);
            expect((await request(app).post('/api/locations').set(as.retailer)
                .send({ name: 'Theirs', store_id: otherStoreId })).status).toBe(403);
        });

        test('a Location is deleted only by someone who manages its Retailer', async () => {
            const { body: location } = await createLocation('Doomed');

            expect((await request(app).delete(`/api/locations/${location.id}`).set(as.brand)).status).toBe(403);
            expect((await request(app).delete(`/api/locations/${location.id}`).set(as.retailer)).status).toBe(204);
            expect((await request(app).delete(`/api/locations/${location.id}`).set(as.retailer)).status).toBe(403);
        });

        describe('its Hourly Loops', () => {
            const FUTURE = '2035-03-05';
            let location;

            const createLoop = async (id, fields) => {
                created.loops.push(id);
                await repositories.loopRepository.create(id, {
                    location_id: location.id, store_id: storeId, retailer_id: retailerId, hour: 10, slots: FULL_HOURLY_LOOP, ...fields,
                });
            };

            beforeAll(async () => {
                ({ body: location } = await createLocation('Counter'));
                await createLoop(`net-loop-pending-${suffix}`, { date: FUTURE });
                await createLoop(`net-loop-approved-${suffix}`, { date: FUTURE, hour: 11, status: 'approved' });
            });

            test('are listed for the Location, by date and status', async () => {
                const all = await request(app).get(`/api/locations/${location.id}/loops`).set(as.retailer);
                expect(all.status).toBe(200);
                expect(all.body).toHaveLength(2);

                const pending = await request(app)
                    .get(`/api/locations/${location.id}/loops?date=${FUTURE}&status=pending_approval`).set(as.retailer);
                expect(pending.body.map(loop => loop.id)).toEqual([`net-loop-pending-${suffix}`]);
                expect((await request(app).get(`/api/locations/missing-${suffix}/loops`).set(as.retailer)).status).toBe(403);
            });

            test('are approved together only by the Retailer Administrator', async () => {
                const url = `/api/locations/${location.id}/loops/approve-all`;
                expect((await request(app).post(url).set(as.admin).send({ date: FUTURE })).status).toBe(403);

                const approved = await request(app).post(url).set(as.retailer).send({ date: FUTURE });
                expect(approved.status).toBe(200);
                expect(approved.body).toEqual({ approved: 1 });
                const saved = await firestore.collection('loops').doc(`net-loop-pending-${suffix}`).get();
                expect(saved.data().status).toBe('approved');

                const again = await request(app).post(url).set(as.retailer).send({ date: FUTURE });
                expect(again.body).toEqual({ approved: 0, message: 'No pending loops found for this location' });
            });

            test('cannot be approved once their broadcast has started', async () => {
                await createLoop(`net-loop-past-${suffix}`, { date: '2020-01-06' });

                const response = await request(app).post(`/api/locations/${location.id}/loops/approve-all`)
                    .set(as.retailer).send({ date: '2020-01-06' });

                expect(response.status).toBe(409);
                expect(response.body).toEqual({ error: 'Approval window is closed' });
            });

            test('a storage failure answers 500', async () => {
                failStorage(repositories.loopRepository, 'findAll');
                expect((await request(app).get(`/api/locations/${location.id}/loops`).set(as.retailer)).status).toBe(500);
                expect((await request(app).post(`/api/locations/${location.id}/loops/approve-all`)
                    .set(as.retailer).send({})).status).toBe(500);
            });
        });

        test('a storage failure answers 500 on every Location route', async () => {
            const { locationRepository } = repositories;
            failStorage(locationRepository, 'findAll');
            expect((await request(app).get('/api/locations').set(as.admin)).status).toBe(500);
            failStorage(locationRepository, 'create');
            expect((await request(app).post('/api/locations').set(as.admin).send({ name: 'X', store_id: storeId })).status).toBe(500);
            failStorage(locationRepository, 'findById');
            expect((await request(app).delete(`/api/locations/any-${suffix}`).set(as.admin)).status).toBe(500);
        });
    });

    describe('Screens', () => {
        let location;

        beforeAll(async () => {
            ({ body: location } = await createLocation('Window'));
        });

        const register = (body, headers = as.tech) => request(app).post('/api/screens').set(headers).send(body);
        const newScreen = async name => {
            const screenId = `net-screen-${name}-${suffix}`;
            created.screens.push(screenId);
            const response = await register({
                screen_id: screenId, store_id: storeId, location_id: location.id, resolution: '1920x1080', user_agent: 'Player/1',
            });
            return response;
        };

        test('a registered Screen starts offline and its device key is shown only once', async () => {
            const response = await newScreen('first');

            expect(response.status).toBe(201);
            expect(response.body).toEqual(expect.objectContaining({
                screen_id: `net-screen-first-${suffix}`, retailer_id: retailerId, store_id: storeId,
                location_id: location.id, status: 'OFFLINE', resolution: '1920x1080', user_agent: 'Player/1',
                device_key: expect.any(String),
            }));

            const again = await newScreen('first');
            expect(again.status).toBe(200);
            expect(again.body.device_key).toBeUndefined();
            expect(again.body.device_key_hash).toBeUndefined();
        });

        test('a Screen needs its Store and a Location in that Store', async () => {
            expect((await register({ screen_id: 'x' })).status).toBe(400);
            const mismatched = await register({ screen_id: `net-screen-bad-${suffix}`, store_id: otherStoreId, location_id: location.id });
            expect(mismatched.status).toBe(400);
            expect(mismatched.body).toEqual({ error: 'Location must belong to the selected Store' });
        });

        test('a Retailer Administrator sees only their Retailer\'s Screens, and a Brand none', async () => {
            await newScreen('listed');

            const network = await request(app).get('/api/screens').set(as.tech);
            expect(network.status).toBe(200);
            expect(network.body.map(screen => screen.id)).toContain(`net-screen-listed-${suffix}`);
            expect(network.body.every(screen => screen.device_key_hash === undefined)).toBe(true);

            const own = await request(app).get('/api/screens').set(as.retailer);
            expect(own.body.length).toBeGreaterThan(0);
            expect(own.body.every(screen => screen.retailer_id === retailerId)).toBe(true);

            expect((await request(app).get('/api/screens').set(as.unlinkedRetailer)).status).toBe(403);
            const brand = await request(app).get('/api/screens').set(as.brand);
            expect(brand.status).toBe(403);
            expect(brand.body).toEqual({ error: 'Forbidden', required: 'techoperator', actual: 'brand' });
        });

        test('a Screen\'s logs are its recent impressions', async () => {
            const screenId = `net-screen-first-${suffix}`;
            const logs = await request(app).get(`/api/screens/${screenId}/logs`).set(as.tech);
            expect(logs.status).toBe(200);
            expect(logs.body).toEqual({ screen_id: screenId, logs: expect.any(Array) });

            const missing = await request(app).get(`/api/screens/missing-${suffix}/logs`).set(as.tech);
            expect(missing.status).toBe(404);
        });

        test('a Screen is switched between active and inactive', async () => {
            const { body: screen } = await newScreen('toggle');

            const active = await request(app).patch(`/api/screens/${screen.id}/status`).set(as.tech).send({ status: 'active' });
            expect(active.status).toBe(200);
            expect(active.body.status).toBe('ONLINE');
            const inactive = await request(app).patch(`/api/screens/${screen.id}/status`).set(as.tech).send({ status: 'inactive' });
            expect(inactive.status).toBe(200);
            expect(inactive.body.status).toBe('OFFLINE');

            expect((await request(app).patch(`/api/screens/${screen.id}/status`).set(as.tech).send({ status: 'broken' })).status).toBe(400);
            expect((await request(app).patch(`/api/screens/missing-${suffix}/status`).set(as.tech).send({ status: 'active' })).status).toBe(404);
        });

        test('a replacement device key is issued for an existing Screen only', async () => {
            const { body: screen } = await newScreen('rotate');

            const rotated = await request(app).post(`/api/screens/${screen.id}/device-key`).set(as.tech);
            expect(rotated.status).toBe(200);
            expect(rotated.body).toEqual({ screen_id: screen.id, device_key: expect.any(String) });
            expect(rotated.body.device_key).not.toBe(screen.device_key);

            expect((await request(app).post(`/api/screens/missing-${suffix}/device-key`).set(as.tech)).status).toBe(404);
        });

        test('a deleted Screen is gone', async () => {
            const { body: screen } = await newScreen('removed');

            expect((await request(app).delete(`/api/screens/${screen.id}`).set(as.tech)).status).toBe(204);
            expect((await firestore.collection('screens').doc(screen.id).get()).exists).toBe(false);
        });

        test('an unavailable database answers 503 with when to retry', async () => {
            const breakerOpen = Object.assign(new Error('Circuit open'), { code: 'CIRCUIT_BREAKER_OPEN', retryAfterMs: 4500 });
            failStorage(repositories.screenRepository, 'create', breakerOpen);

            const registered = await register({ screen_id: `net-screen-503-${suffix}`, store_id: storeId, location_id: location.id });
            expect(registered.status).toBe(503);
            expect(registered.headers['retry-after']).toBe('5');
            expect(registered.body.retryAfterSeconds).toBe(5);

            const { deviceCredentialService } = await import('../src/services/DeviceCredentialService.js');
            failStorage(deviceCredentialService, 'rotate', Object.assign(new Error('Circuit open'), { code: 'CIRCUIT_BREAKER_OPEN' }));
            const rotated = await request(app).post(`/api/screens/net-screen-first-${suffix}/device-key`).set(as.tech);
            expect(rotated.status).toBe(503);
            expect(rotated.headers['retry-after']).toBe('30');
        });

        test('a storage failure answers 500, or 503 when a device key cannot be issued', async () => {
            const { screenRepository, impressionRepository } = repositories;
            const screenId = `net-screen-first-${suffix}`;

            failStorage(screenRepository, 'create');
            expect((await register({ screen_id: `net-screen-500-${suffix}`, store_id: storeId, location_id: location.id })).status).toBe(500);
            failStorage(screenRepository, 'findAll');
            expect((await request(app).get('/api/screens').set(as.tech)).status).toBe(500);
            failStorage(impressionRepository, 'findAll');
            expect((await request(app).get(`/api/screens/${screenId}/logs`).set(as.tech)).status).toBe(500);
            failStorage(screenRepository, 'delete');
            expect((await request(app).delete(`/api/screens/${screenId}`).set(as.tech)).status).toBe(500);
            failStorage(screenRepository, 'updateStatus');
            expect((await request(app).patch(`/api/screens/${screenId}/status`).set(as.tech).send({ status: 'active' })).status).toBe(500);

            const { deviceCredentialService } = await import('../src/services/DeviceCredentialService.js');
            failStorage(deviceCredentialService, 'rotate');
            const rotated = await request(app).post(`/api/screens/${screenId}/device-key`).set(as.tech);
            expect(rotated.status).toBe(503);
            expect(rotated.body).toEqual({ error: 'Device key could not be issued' });
        });
    });
});
