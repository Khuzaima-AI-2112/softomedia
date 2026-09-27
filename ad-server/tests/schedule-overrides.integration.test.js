import { jest, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { retailerRepository, StoreRepository } = await import('../src/repositories/index.js');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');

const app = createTestApp(apiRouter, '/api');

jest.setTimeout(30_000);

const OVERRIDE = { store_id: 'store-one', day: 'sunday', start: '09:00', end: '11:00', type: 'blocked' };

async function seedStores() {
    await retailerRepository.create('retailer-one', { name: 'Northwind Cafés', status: 'active' });
    await retailerRepository.create('retailer-two', { name: 'Contoso Coffee', status: 'active' });
    await StoreRepository.create('store-one', {
        name: 'Northwind Downtown', retailer_id: 'retailer-one', status: 'active', time_zone: 'America/Toronto',
    });
    await StoreRepository.create('store-two', {
        name: 'Contoso Uptown', retailer_id: 'retailer-two', status: 'active', time_zone: 'America/Toronto',
    });
}

describeWithAuthEmulator('Retailer schedule overrides (#16)', () => {
    let retailerAdmin;

    beforeEach(async () => {
        clearMockStorage();
        await seedStores();
        ({ headers: retailerAdmin } = await signInAs('retaileradmin', { organizationId: 'retailer-one' }));
    });

    const save = (headers, body) => request(app).post('/api/schedules').set(headers).send(body);
    const list = (headers, storeId) => request(app).get('/api/schedules').query({ store_id: storeId }).set(headers);

    test('a saved override is still there when the Store\'s overrides are read again', async () => {
        const saved = await save(retailerAdmin, OVERRIDE);

        expect(saved.status).toBe(201);
        expect(saved.body).toEqual(expect.objectContaining({ id: expect.any(String), ...OVERRIDE }));

        const reloaded = await list(retailerAdmin, 'store-one');
        expect(reloaded.status).toBe(200);
        expect(reloaded.body).toEqual([expect.objectContaining({ id: saved.body.id, ...OVERRIDE })]);
    });

    test('lists a Store\'s overrides by day of the week, then start time', async () => {
        await save(retailerAdmin, { ...OVERRIDE, day: 'friday', start: '14:00', end: '15:00' });
        await save(retailerAdmin, { ...OVERRIDE, day: 'monday', start: '12:00', end: '13:00' });
        await save(retailerAdmin, { ...OVERRIDE, day: 'monday', start: '08:00', end: '09:00', type: 'forced' });

        const reloaded = await list(retailerAdmin, 'store-one');

        expect(reloaded.body.map(({ day, start }) => `${day} ${start}`))
            .toEqual(['monday 08:00', 'monday 12:00', 'friday 14:00']);
    });

    test('an override belongs to its Store only', async () => {
        const { headers: admin } = await signInAs('admin');
        await save(admin, { ...OVERRIDE, store_id: 'store-two' });
        await save(retailerAdmin, OVERRIDE);

        const reloaded = await list(retailerAdmin, 'store-one');

        expect(reloaded.body.map(({ store_id: storeId }) => storeId)).toEqual(['store-one']);
    });

    test('an Admin can save an override for any Retailer\'s Store', async () => {
        const { headers: admin } = await signInAs('admin');

        const saved = await save(admin, { ...OVERRIDE, store_id: 'store-two' });

        expect(saved.status).toBe(201);
        expect((await list(admin, 'store-two')).body).toHaveLength(1);
    });

    test('a Retailer Administrator can neither save nor read another Retailer\'s overrides', async () => {
        const saved = await save(retailerAdmin, { ...OVERRIDE, store_id: 'store-two' });
        const read = await list(retailerAdmin, 'store-two');

        expect([saved.status, read.status]).toEqual([403, 403]);
    });

    test('an unknown Store is refused like a foreign one', async () => {
        const saved = await save(retailerAdmin, { ...OVERRIDE, store_id: 'no-such-store' });

        expect(saved.status).toBe(403);
    });

    test('a Brand cannot save or read overrides', async () => {
        const { headers: brand } = await signInAs('brand', { organizationId: 'brand-one' });

        const [saved, read] = await Promise.all([save(brand, OVERRIDE), list(brand, 'store-one')]);

        expect([saved.status, read.status]).toEqual([403, 403]);
    });

    test.each([
        ['no Store', { store_id: undefined }, 'store_id is required'],
        ['an unknown day', { day: 'someday' }, 'day must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday'],
        ['no start time', { start: '' }, 'start and end must be times in HH:MM'],
        ['a malformed end time', { end: '25:00' }, 'start and end must be times in HH:MM'],
        ['an end before the start', { start: '11:00', end: '09:00' }, 'end must be after start'],
        ['an end equal to the start', { start: '09:00', end: '09:00' }, 'end must be after start'],
        ['an unknown type', { type: 'maybe' }, 'type must be one of: blocked, forced'],
    ])('refuses an override with %s and saves nothing', async (_, change, error) => {
        const saved = await save(retailerAdmin, { ...OVERRIDE, ...change });

        expect(saved.status).toBe(400);
        expect(saved.body).toEqual({ error });
        expect((await list(retailerAdmin, 'store-one')).body).toEqual([]);
    });

    test('saves only the override\'s own fields', async () => {
        const saved = await save(retailerAdmin, { ...OVERRIDE, id: 'chosen-id', retailer_id: 'retailer-two', extra: true });

        expect(saved.body.id).not.toBe('chosen-id');
        expect(saved.body.retailer_id).toBe('retailer-one');
        expect(saved.body).not.toHaveProperty('extra');
    });

    test('reading overrides needs a Store', async () => {
        const read = await request(app).get('/api/schedules').set(retailerAdmin);

        expect(read.status).toBe(400);
        expect(read.body).toEqual({ error: 'store_id is required' });
    });
});
