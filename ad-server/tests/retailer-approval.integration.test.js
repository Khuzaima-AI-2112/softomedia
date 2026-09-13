import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { default: StoreRepository } = await import('../src/repositories/StoreRepository.js');
const { loopRepository, LOOP_STATUS } = await import('../src/repositories/LoopRepository.js');
const { dailyScheduleRepository } = await import('../src/repositories/DailyScheduleRepository.js');
const { schedulingAuditRepository } = await import('../src/repositories/SchedulingAuditRepository.js');

const app = createTestApp(apiRouter, '/api');
const headersFor = (role, retailerId = 'retailer-one') => ({
    Authorization: 'Bearer demo-token',
    'x-demo-role': role,
    'x-demo-retailer-id': retailerId,
});

const fullSlots = () => Array.from({ length: 12 }, (_, position) => ({
    position,
    asset_id: `asset-${position}`,
    status: 'pending',
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
            status: LOOP_STATUS.PENDING_APPROVAL,
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

describe('Store-scoped Retailer schedule approval', () => {
    beforeEach(() => {
        clearMockStorage();
        jest.useFakeTimers({
            now: new Date('2026-03-08T12:00:00.000Z'),
            doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'],
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('shows only an own Store review with its time zone and DST-correct normal deadline', async () => {
        const [ownLoop] = await seedSchedule();
        await seedSchedule({
            storeId: 'store-two',
            retailerId: 'retailer-two',
            timeZone: 'Europe/Berlin',
            date: '2026-03-30',
            hours: [8],
        });

        const review = await request(app)
            .get('/api/loops/review/store-one/2026-03-09')
            .set(headersFor('retaileradmin'));

        expect(review.status).toBe(200);
        expect(review.body).toMatchObject({
            store: { id: 'store-one', time_zone: 'America/Toronto' },
            approval_window: {
                normal_deadline: '2026-03-08T22:00:00.000Z',
                effective_deadline: '2026-03-08T22:00:00.000Z',
                state: 'open',
            },
        });
        expect(review.body.loops.map(loop => loop.id)).toEqual([ownLoop.id, 'store-one-2026-03-09-9']);

        const foreign = await request(app)
            .get('/api/loops/review/store-two/2026-03-30')
            .set(headersFor('retaileradmin'));
        expect(foreign.status).toBe(403);
        expect(foreign.body).toEqual({ error: 'Access denied' });

        const foreignDirectRead = await request(app)
            .get('/api/loops/store-two-2026-03-30-8')
            .set(headersFor('retaileradmin'));
        expect(foreignDirectRead.status).toBe(403);

        const foreignPendingRead = await request(app)
            .get('/api/loops/pending/retailer-two')
            .set(headersFor('retaileradmin'));
        expect(foreignPendingRead.status).toBe(403);

        const adminReview = await request(app)
            .get('/api/loops/review/store-two/2026-03-30')
            .set(headersFor('admin'));
        expect(adminReview.status).toBe(200);
        expect(adminReview.body.approval_window.normal_deadline).toBe('2026-03-29T16:00:00.000Z');
    });

    test('allows retailer approval only before the exact Store-local normal deadline and persists it', async () => {
        const [beforeBoundary, atBoundary] = await seedSchedule();

        jest.setSystemTime(new Date('2026-03-08T21:59:59.999Z'));
        const approved = await request(app)
            .patch(`/api/loops/${beforeBoundary.id}/approve`)
            .set(headersFor('retaileradmin'));
        expect(approved.status).toBe(200);
        expect(approved.body).toMatchObject({ status: 'approved', approved_by: 'demo-retaileradmin' });
        expect((await loopRepository.findById(beforeBoundary.id)).status).toBe('approved');

        jest.setSystemTime(new Date('2026-03-08T22:00:00.000Z'));
        const expired = await request(app)
            .patch(`/api/loops/${atBoundary.id}/approve`)
            .set(headersFor('retaileradmin'));
        expect(expired.status).toBe(409);
        expect(expired.body).toEqual({ error: 'Approval window is closed' });
        expect((await loopRepository.findById(atBoundary.id)).status).toBe('pending_approval');

        for (const role of ['admin', 'superadmin']) {
            const denied = await request(app)
                .patch(`/api/loops/${atBoundary.id}/approve`)
                .set(headersFor(role));
            expect(denied.status).toBe(403);
            expect(denied.body).toEqual({ error: 'Access denied' });
        }
    });

    test('persists an audited reopening without approving and enforces its exact expiry', async () => {
        const [beforeExpiry, atExpiry] = await seedSchedule();
        jest.setSystemTime(new Date('2026-03-08T23:00:00.000Z'));

        const reopened = await request(app)
            .post('/api/loops/review/store-one/2026-03-09/reopen')
            .set(headersFor('admin'))
            .send({ reason: 'Corrected creative ready for retailer review', expires_at: '2026-03-09T11:30:00.000Z' });

        expect(reopened.status).toBe(200);
        expect(reopened.body).toMatchObject({
            state: 'open',
            effective_deadline: '2026-03-09T11:30:00.000Z',
            reopened: {
                actor_id: 'demo-admin',
                actor_role: 'admin',
                reason: 'Corrected creative ready for retailer review',
                store_id: 'store-one',
                broadcast_date: '2026-03-09',
                expires_at: '2026-03-09T11:30:00.000Z',
                reopened_at: '2026-03-08T23:00:00.000Z',
            },
        });
        expect((await loopRepository.findById(beforeExpiry.id)).status).toBe('pending_approval');
        expect((await dailyScheduleRepository.findByStoreAndDate('store-one', '2026-03-09')).approval_window)
            .toEqual(reopened.body);
        expect(await schedulingAuditRepository.findByLocation('missing-location')).toEqual([]);
        expect(await schedulingAuditRepository.findAll()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                action: 'approval_window_reopened',
                user_id: 'demo-admin',
                reason: 'Corrected creative ready for retailer review',
                store_id: 'store-one',
                broadcast_date: '2026-03-09',
                expires_at: '2026-03-09T11:30:00.000Z',
                timestamp: '2026-03-08T23:00:00.000Z',
            }),
        ]));

        const duplicateReopen = await request(app)
            .post('/api/loops/review/store-one/2026-03-09/reopen')
            .set(headersFor('superadmin'))
            .send({ reason: 'Window is already open', expires_at: '2026-03-09T11:45:00.000Z' });
        expect(duplicateReopen.status).toBe(409);
        expect(duplicateReopen.body).toEqual({ error: 'Approval window is still open' });

        jest.setSystemTime(new Date('2026-03-09T11:29:59.999Z'));
        expect((await request(app)
            .patch(`/api/loops/${beforeExpiry.id}/approve`)
            .set(headersFor('retaileradmin'))).status).toBe(200);

        jest.setSystemTime(new Date('2026-03-09T11:30:00.000Z'));
        const expired = await request(app)
            .patch(`/api/loops/${atExpiry.id}/approve`)
            .set(headersFor('retaileradmin'));
        expect(expired.status).toBe(409);
        expect(expired.body).toEqual({ error: 'Approval window is closed' });
    });

    test('rejects invalid reopening requests and reopening after broadcasting starts', async () => {
        await seedSchedule();
        jest.setSystemTime(new Date('2026-03-08T23:00:00.000Z'));

        const cases = [
            [{ expires_at: '2026-03-09T11:00:00.000Z' }, 400, 'Reason is required'],
            [{ reason: 'Late review', expires_at: '2026-03-08T22:59:59.999Z' }, 400, 'Expiry must be in the future'],
            [{ reason: 'Late review', expires_at: '2026-03-09T12:00:00.001Z' }, 400, 'Expiry cannot be after first broadcast'],
        ];
        for (const [body, status, error] of cases) {
            const response = await request(app)
                .post('/api/loops/review/store-one/2026-03-09/reopen')
                .set(headersFor('admin'))
                .send(body);
            expect(response.status).toBe(status);
            expect(response.body).toEqual({ error });
        }

        const retailerDenied = await request(app)
            .post('/api/loops/review/store-one/2026-03-09/reopen')
            .set(headersFor('retaileradmin'))
            .send({ reason: 'Not permitted', expires_at: '2026-03-09T11:00:00.000Z' });
        expect(retailerDenied.status).toBe(403);

        const superAdminReopened = await request(app)
            .post('/api/loops/review/store-one/2026-03-09/reopen')
            .set(headersFor('superadmin'))
            .send({ reason: 'Authorized late review', expires_at: '2026-03-09T07:45' });
        expect(superAdminReopened.status).toBe(200);
        expect(superAdminReopened.body.reopened).toMatchObject({
            actor_id: 'demo-superadmin',
            actor_role: 'superadmin',
            expires_at: '2026-03-09T11:45:00.000Z',
        });

        jest.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
        const broadcastStarted = await request(app)
            .post('/api/loops/review/store-one/2026-03-09/reopen')
            .set(headersFor('superadmin'))
            .send({ reason: 'Too late', expires_at: '2026-03-09T12:30:00.000Z' });
        expect(broadcastStarted.status).toBe(409);
        expect(broadcastStarted.body).toEqual({ error: 'Broadcasting has started' });
    });

    test('persists replacement requests, lets only Admin correct them, and returns the schedule to review', async () => {
        const [loop] = await seedSchedule();

        const requested = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/reject`)
            .set(headersFor('retaileradmin'))
            .send({ reason: 'Competitor content is not accepted' });
        expect(requested.status).toBe(200);
        expect(requested.body).toMatchObject({
            status: 'replacement_requested',
            slots: expect.arrayContaining([
                expect.objectContaining({
                    position: 3,
                    status: 'rejected',
                    rejection_reason: 'Competitor content is not accepted',
                    rejected_by: 'demo-retaileradmin',
                }),
            ]),
        });

        const retailerCannotReplace = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/replace`)
            .set(headersFor('retaileradmin'))
            .send({ assetId: 'corrected-asset' });
        expect(retailerCannotReplace.status).toBe(403);

        const corrected = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/replace`)
            .set(headersFor('admin'))
            .send({ assetId: 'corrected-asset' });
        expect(corrected.status).toBe(200);
        expect(corrected.body).toMatchObject({
            status: 'pending_approval',
            approved_at: null,
            approved_by: null,
            slots: expect.arrayContaining([
                expect.objectContaining({ position: 3, asset_id: 'corrected-asset', status: 'replaced' }),
            ]),
        });

        const persistedReview = await request(app)
            .get('/api/loops/review/store-one/2026-03-09')
            .set(headersFor('retaileradmin'));
        expect(persistedReview.body.loops[0].slots[3]).toMatchObject({
            asset_id: 'corrected-asset',
            rejection_reason: 'Competitor content is not accepted',
        });

        const foreignRetailer = await request(app)
            .patch(`/api/loops/${loop.id}/slots/2/reject`)
            .set(headersFor('retaileradmin', 'retailer-two'))
            .send({ reason: 'Should not see this schedule' });
        expect(foreignRetailer.status).toBe(403);

        const superAdminCannotReplace = await request(app)
            .patch(`/api/loops/${loop.id}/slots/3/replace`)
            .set(headersFor('superadmin'))
            .send({ assetId: 'another-asset' });
        expect(superAdminCannotReplace.status).toBe(403);
    });
});
