import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const screens = new Map();

const screenRepository = {
    create: jest.fn(async (id, data) => {
        const record = { id, ...data };
        screens.set(id, record);
        return record;
    }),
    findAll: jest.fn(async () => [...screens.values()]),
    findById: jest.fn(async id => screens.get(id) || null),
    update: jest.fn(async (id, data) => {
        const record = { ...(screens.get(id) || { id }), ...data };
        screens.set(id, record);
        return record;
    }),
    updateHeartbeat: jest.fn(async (id, status = 'ONLINE', seenAt = new Date()) => {
        if (!screens.has(id)) throw new Error('Screen not found');
        const record = {
            ...screens.get(id),
            last_seen: seenAt.toISOString(),
            status,
        };
        screens.set(id, record);
        return record;
    }),
    delete: jest.fn(async id => screens.delete(id)),
    hasActiveOrUpcomingCampaigns: jest.fn(async () => false),
    updateStatus: jest.fn(),
};

const locationRepository = {
    findById: jest.fn(async id => id === 'location-entrance'
        ? { id, store_id: 'store-north', retailer_id: 'retailer-a' }
        : null),
};

const storeRepository = {
    findById: jest.fn(async id => id === 'store-north'
        ? { id, retailer_id: 'retailer-a' }
        : null),
};

const loopRepository = {
    findAll: jest.fn(async () => []),
};

jest.unstable_mockModule('../src/repositories/index.js', () => ({
    screenRepository,
    impressionRepository: { findAll: jest.fn(async () => []) },
    locationRepository,
    loopRepository,
    playbackObservationRepository: { findAll: jest.fn(async () => []) },
}));

jest.unstable_mockModule('../src/repositories/StoreRepository.js', () => ({
    default: storeRepository,
    StoreRepository: storeRepository,
}));

jest.unstable_mockModule('../src/repositories/LoopRepository.js', () => ({
    loopRepository: { findAll: jest.fn(async () => []) },
    LOOP_STATUS: { APPROVED: 'approved' },
}));

jest.unstable_mockModule('../src/services/AuthService.js', () => ({
    authService: { resolveFirebaseIdentity: jest.fn() },
}));

jest.unstable_mockModule('../src/utils/firebaseAuth.js', () => ({
    getFirebaseAuth: jest.fn(),
}));

const { default: screensRouter } = await import('../src/api/screens.js');
const { HeartbeatService } = await import('../src/services/HeartbeatService.js');
const heartbeatService = new HeartbeatService();
const operationalHealthService = {
    check: jest.fn(async () => ({
        backend: { state: 'healthy' },
        firestore: { state: 'unavailable' },
        storage: { state: 'healthy' },
        checked_at: '2026-09-12T00:00:00.000Z',
    })),
};

jest.unstable_mockModule('../src/services/index.js', () => ({
    heartbeatService,
    operationalHealthService,
}));

const { default: monitoringRouter } = await import('../src/api/monitoring.js');

function appFor(role) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.headers.authorization = 'Bearer demo-token';
        req.headers['x-demo-role'] = role;
        next();
    });
    app.use('/api/screens', screensRouter);
    return app;
}

function monitoringAppFor(role) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user = { id: `${role}-user`, role };
        next();
    });
    app.use('/api/monitoring', monitoringRouter);
    return app;
}

describe('Technical Operator Screen registration', () => {
    beforeEach(() => {
        screens.clear();
        jest.clearAllMocks();
    });

    test('persists the intended Retailer, Store, and Location and returns it after reload', async () => {
        const app = appFor('techoperator');

        const created = await request(app).post('/api/screens').send({
            screen_id: 'screen-entrance-1',
            retailer_id: 'retailer-a',
            store_id: 'store-north',
            location_id: 'location-entrance',
            resolution: '1920x1080',
        });

        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({
            id: 'screen-entrance-1',
            screen_id: 'screen-entrance-1',
            retailer_id: 'retailer-a',
            store_id: 'store-north',
            location_id: 'location-entrance',
            status: 'OFFLINE',
            last_seen: null,
        });

        const reloaded = await request(app).get('/api/screens');
        expect(reloaded.status).toBe(200);
        expect(reloaded.body).toContainEqual(expect.objectContaining({
            id: 'screen-entrance-1',
            store_id: 'store-north',
            location_id: 'location-entrance',
        }));
    });

    test.each(['brand', 'retaileradmin'])(
        'denies Screen registration to %s',
        async role => {
            const response = await request(appFor(role)).post('/api/screens').send({
                screen_id: `screen-${role}`,
                retailer_id: 'retailer-a',
                store_id: 'store-north',
                location_id: 'location-entrance',
            });

            expect(response.status).toBe(403);
        },
    );
});

describe('Screen heartbeat connectivity', () => {
    beforeEach(() => {
        screens.clear();
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-12T00:00:00.000Z'));
    });

    afterEach(() => jest.useRealTimers());

    test('is online before two minutes and offline at the two-minute boundary', async () => {
        screens.set('screen-clock', {
            id: 'screen-clock',
            screen_id: 'screen-clock',
            status: 'OFFLINE',
            last_seen: null,
        });
        const service = new HeartbeatService();

        await service.recordHeartbeat('screen-clock');
        expect(screens.get('screen-clock')).toMatchObject({
            status: 'ONLINE',
            last_seen: '2026-09-12T00:00:00.000Z',
        });

        jest.setSystemTime(new Date('2026-09-12T00:01:59.999Z'));
        expect(await service.checkScreenHealth()).toEqual([]);
        expect(screens.get('screen-clock').status).toBe('ONLINE');

        jest.setSystemTime(new Date('2026-09-12T00:02:00.000Z'));
        expect(await service.checkScreenHealth()).toEqual(['screen-clock']);
        expect(screens.get('screen-clock').status).toBe('OFFLINE');
    });

    test('reports connectivity separately from approved schedule availability', async () => {
        screens.set('screen-status', {
            id: 'screen-status',
            screen_id: 'screen-status',
            retailer_id: 'retailer-a',
            store_id: 'store-north',
            location_id: 'location-entrance',
            status: 'OFFLINE',
            last_seen: null,
        });
        const app = monitoringAppFor('techoperator');

        expect((await request(app).post('/api/monitoring/heartbeat').send({
            screenId: 'screen-status',
        })).status).toBe(200);

        const withoutSchedule = await request(app).get('/api/monitoring/status');
        expect(withoutSchedule.status).toBe(200);
        expect(withoutSchedule.body.screens[0]).toMatchObject({
            id: 'screen-status',
            connectivity: 'online',
            schedule: { state: 'unavailable', approved: false },
        });

        loopRepository.findAll.mockResolvedValueOnce([{
            id: 'approved-loop',
            status: 'approved',
            date: '2026-09-12',
            location_id: 'location-entrance',
        }]);
        const withSchedule = await request(app).get('/api/monitoring/status');
        expect(withSchedule.body.screens[0]).toMatchObject({
            connectivity: 'online',
            schedule: { state: 'available', approved: true },
        });
    });

    test('denies network-wide health status to Brand and Retailer Administrator', async () => {
        for (const role of ['brand', 'retaileradmin']) {
            const response = await request(monitoringAppFor(role)).get('/api/monitoring/status');
            expect(response.status).toBe(403);
        }
    });

    test('reports Backend, Firestore, and Cloud Storage independently without false health', async () => {
        jest.useRealTimers();
        const response = await request(monitoringAppFor('techoperator')).get('/api/monitoring/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            backend: { state: 'healthy' },
            firestore: { state: 'unavailable' },
            storage: { state: 'healthy' },
            checked_at: '2026-09-12T00:00:00.000Z',
        });
        expect(response.body.firestore.state).not.toBe('healthy');
    });
});
