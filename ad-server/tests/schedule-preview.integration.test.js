import { jest, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { default: StoreRepository } = await import('../src/repositories/StoreRepository.js');
const { locationRepository } = await import('../src/repositories/LocationRepository.js');
const { loopRepository } = await import('../src/repositories/LoopRepository.js');
const { dailyScheduleRepository } = await import('../src/repositories/DailyScheduleRepository.js');

const app = createTestApp(apiRouter, '/api');
const { describeWithAuthEmulator, signInAs } = await import('./fixtures/emulator-sign-in.js');

// Only a Retailer Administrator belongs to a Retailer; the other roles work network-wide.
const headersFor = async (role, retailerId = 'retailer-one') => (await signInAs(role, {
    organizationId: role === 'retaileradmin' ? retailerId : null,
})).headers;

const fullSlots = () => Array.from({ length: 12 }, (_, position) => ({
    position,
    asset_id: `asset-${position}`,
    duration: 5,
}));

async function seedSchedule({
    storeId = 'store-one',
    retailerId = 'retailer-one',
    timeZone = 'America/Toronto',
    date = '2026-03-09',
    hours = [8, 9],
} = {}) {
    await StoreRepository.create(storeId, {
        name: `${storeId} name`,
        retailer_id: retailerId,
        time_zone: timeZone,
    });
    const loops = [];
    for (const hour of hours) {
        loops.push(await loopRepository.create(`${storeId}-${date}-${hour}`, {
            date,
            hour,
            retailer_id: retailerId,
            store_id: storeId,
            slots: fullSlots(),
        }));
    }
    await dailyScheduleRepository.save(storeId, date, {
        retailer_id: retailerId,
        operating_hours: hours,
        loop_ids: loops.map(loop => loop.id),
    });
    return loops;
}

// Nobody approves an Hourly Loop; the Retailer Administrator previews it (ADR 0007, #21).
describeWithAuthEmulator('Store-scoped schedule preview', () => {
    beforeEach(() => {
        clearMockStorage();
    });

    test('shows only an own Store schedule, with its time zone, in hour order', async () => {
        const [ownLoop] = await seedSchedule();
        await seedSchedule({
            storeId: 'store-two',
            retailerId: 'retailer-two',
            timeZone: 'Europe/Berlin',
            date: '2026-03-30',
            hours: [8],
        });

        const preview = await request(app)
            .get('/api/loops/review/store-one/2026-03-09')
            .set(await headersFor('retaileradmin'));

        expect(preview.status).toBe(200);
        expect(preview.body).toEqual({
            store: { id: 'store-one', name: 'store-one name', time_zone: 'America/Toronto' },
            broadcast_date: '2026-03-09',
            loops: [expect.objectContaining({ id: ownLoop.id }), expect.objectContaining({ id: 'store-one-2026-03-09-9' })],
        });

        const foreign = await request(app)
            .get('/api/loops/review/store-two/2026-03-30')
            .set(await headersFor('retaileradmin'));
        expect(foreign.status).toBe(403);
        expect(foreign.body).toEqual({ error: 'Access denied' });

        const foreignDirectRead = await request(app)
            .get('/api/loops/store-two-2026-03-30-8')
            .set(await headersFor('retaileradmin'));
        expect(foreignDirectRead.status).toBe(403);

        const adminPreview = await request(app)
            .get('/api/loops/review/store-two/2026-03-30')
            .set(await headersFor('admin'));
        expect(adminPreview.status).toBe(200);
        expect(adminPreview.body.loops).toHaveLength(1);
    });

    test('has no loop approval, rejection or Approval Window routes', async () => {
        const [loop] = await seedSchedule();
        const location = await locationRepository.create('location-one', {
            name: 'Entrance',
            retailer_id: 'retailer-one',
            store_id: 'store-one',
        });
        const retailer = await headersFor('retaileradmin');
        const admin = await headersFor('admin');

        const removed = [
            request(app).patch(`/api/loops/${loop.id}/approve`).set(retailer),
            request(app).post(`/api/loops/${loop.id}/reject`).set(retailer).send({ reason: 'No' }),
            request(app).patch(`/api/loops/${loop.id}/slots/3/reject`).set(retailer).send({ reason: 'No' }),
            request(app).get('/api/loops/pending/retailer-one').set(retailer),
            request(app).post(`/api/locations/${location.id}/loops/approve-all`).set(retailer),
            request(app).post('/api/loops/review/store-one/2026-03-09/reopen').set(admin)
                .send({ reason: 'Late', expires_at: '2026-03-09T11:00:00.000Z' }),
        ];
        for (const response of await Promise.all(removed)) {
            expect(response.status).toBe(404);
        }
        expect(await loopRepository.findById(loop.id)).toEqual(loop);
    });

    test('a corrected Slot leaves its Run, so the Run no longer counts as an Ad Play', async () => {
        const [loop] = await seedSchedule();
        const run = [3, 4].map(position => ({
            ...loop.slots[position], allocated_category: 'paid', run_start: 3, run_length: 2, run_file: position - 3,
        }));
        await loopRepository.update(loop.id, { slots: [...loop.slots.slice(0, 3), ...run, ...loop.slots.slice(5)] });

        const corrected = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/replace`)
            .set(await headersFor('admin'))
            .send({ assetId: 'corrected-asset' });
        expect(corrected.status).toBe(200);

        const [replaced, untouched] = (await loopRepository.findById(loop.id)).slots.slice(3, 5);
        expect(replaced).toEqual(expect.not.objectContaining({ run_start: expect.anything() }));
        expect(untouched).toMatchObject({ run_start: 3, run_length: 2, run_file: 1 });
    });

    test('lets only Admin correct a Slot, in the loop that plays', async () => {
        const [loop] = await seedSchedule();

        const retailerCannotReplace = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/replace`)
            .set(await headersFor('retaileradmin'))
            .send({ assetId: 'corrected-asset' });
        expect(retailerCannotReplace.status).toBe(403);

        const corrected = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/replace`)
            .set(await headersFor('admin'))
            .send({ assetId: 'corrected-asset' });
        expect(corrected.status).toBe(200);
        expect(corrected.body).toMatchObject({
            id: loop.id,
            slots: expect.arrayContaining([
                expect.objectContaining({ position: 3, asset_id: 'corrected-asset', status: 'replaced' }),
            ]),
        });

        const persistedPreview = await request(app)
            .get('/api/loops/review/store-one/2026-03-09')
            .set(await headersFor('retaileradmin'));
        expect(persistedPreview.body.loops[0].slots[3]).toMatchObject({ asset_id: 'corrected-asset' });

        const superAdminCannotReplace = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/replace`)
            .set(await headersFor('superadmin'))
            .send({ assetId: 'another-asset' });
        expect(superAdminCannotReplace.status).toBe(403);
    });
});
