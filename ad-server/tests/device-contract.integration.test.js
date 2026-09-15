import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';
process.env.DEMO_ASSETS_BUCKET = process.env.DEMO_ASSETS_BUCKET
    || `${process.env.GOOGLE_CLOUD_PROJECT}.firebasestorage.app`;

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.STORAGE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

describeWithEmulators('trusted Screen device contract with Firebase emulators', () => {
    const password = 'Phase1-demo-password!';
    const suffix = Date.now();
    let request;
    let app;
    let firestore;
    const tokens = {};

    const as = (persona, pending) => pending.set('Authorization', `Bearer ${tokens[persona]}`);

    const asDevice = (pending, screenId, deviceKey) => pending.set('Authorization', `Device ${screenId}:${deviceKey}`);

    const registeredScreenIds = [];
    const registerScreen = screenId => {
        registeredScreenIds.push(screenId);
        return as('techOperator', request(app).post('/api/screens')).send({
            screen_id: screenId,
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-entrance',
        });
    };

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        const { Storage } = await import('@google-cloud/storage');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

        const { resetDemoBaseline } = await import('../src/services/DemoResetService.js');
        await resetDemoBaseline({
            firestore,
            storage: new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT }),
            activeProjectId: process.env.GOOGLE_CLOUD_PROJECT,
            expectedProjectId: 'softomedia-demo',
            bucketName: process.env.DEMO_ASSETS_BUCKET,
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
        });

        const { provisionDemoPersonas } = await import('../src/services/DemoPersonaProvisioner.js');
        await provisionDemoPersonas({ password, expectedProjectId: 'softomedia-demo' });
        const personas = {
            techOperator: 'techoperator@demo.softomedia.test',
            brand: 'brand@demo.softomedia.test',
        };
        await Promise.all(Object.entries(personas).map(async ([persona, email]) => {
            tokens[persona] = await signIn(email, password);
        }));
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        // Leftover Screens would show up as Bookable Inventory in later suites.
        await Promise.all(registeredScreenIds.map(id => firestore?.collection('screens').doc(id).delete()));
        await firestore?.terminate();
    });

    test('Technical Operator registers a Screen and receives its device key exactly once', async () => {
        const screenId = `device-screen-${suffix}`;

        const registered = await registerScreen(screenId);

        expect(registered.status).toBe(201);
        expect(registered.body).toEqual(expect.objectContaining({
            screen_id: screenId,
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-entrance',
            device_key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        }));
        expect(JSON.stringify(registered.body)).not.toContain('device_key_hash');

        const listed = await as('techOperator', request(app).get('/api/screens'));
        expect(listed.status).toBe(200);
        const listedScreen = listed.body.find(screen => screen.id === screenId);
        expect(listedScreen).toEqual(expect.objectContaining({ screen_id: screenId }));
        expect(JSON.stringify(listedScreen)).not.toMatch(/device_key/);
    });

    test('a Screen reports heartbeats and reads playback only with its own device key', async () => {
        const [first, second] = await Promise.all([
            registerScreen(`device-first-${suffix}`),
            registerScreen(`device-second-${suffix}`),
        ]);
        expect([first.status, second.status]).toEqual([201, 201]);
        const firstId = first.body.screen_id;

        const heartbeat = await asDevice(request(app).post('/api/device/heartbeat'), firstId, first.body.device_key);
        expect(heartbeat.status).toBe(200);
        expect(heartbeat.body).toEqual({ status: 'ok', screen_id: firstId, timestamp: expect.any(String) });

        const status = await as('techOperator', request(app).get('/api/monitoring/status'));
        expect(status.body.screens.find(screen => screen.id === firstId)).toEqual(
            expect.objectContaining({ connectivity: 'online' }),
        );

        const playback = await asDevice(request(app).get('/api/device/playback'), firstId, first.body.device_key);
        expect(playback.status).toBe(200);
        expect(playback.body).toEqual(expect.objectContaining({
            screen_id: firstId,
            playback_mode: 'holding_slide',
        }));

        const rejected = await Promise.all([
            request(app).post('/api/device/heartbeat'),
            asDevice(request(app).post('/api/device/heartbeat'), firstId, 'not-the-device-key'),
            asDevice(request(app).post('/api/device/heartbeat'), firstId, second.body.device_key),
            asDevice(request(app).get('/api/device/playback'), `device-unknown-${suffix}`, first.body.device_key),
            as('techOperator', request(app).post('/api/device/heartbeat')),
        ]);
        for (const response of rejected) {
            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'Device authentication required' });
        }
    });

    test('a Screen cannot report Proof of Play or playback observations for another Screen', async () => {
        const reporter = await registerScreen(`device-reporter-${suffix}`);
        expect(reporter.status).toBe(201);
        const foreignScreenId = 'demo-screen-north-1';
        const presentation = {
            event_id: `device-foreign-event-${suffix}`,
            screen_id: foreignScreenId,
            location_id: 'demo-location-mtl-entrance',
            loop_id: 'any-loop',
            slot_position: 0,
            campaign_id: 'any-campaign',
            asset_id: 'any-asset',
            presentation_started_at: new Date(Date.now() - 1_000).toISOString(),
            intended_duration_seconds: 5,
        };

        const responses = await Promise.all([
            asDevice(request(app).post('/api/device/proof-of-play'), reporter.body.screen_id, reporter.body.device_key)
                .send(presentation),
            asDevice(request(app).post('/api/device/playback-observations'), reporter.body.screen_id, reporter.body.device_key)
                .send({ ...presentation, presentation_type: 'holding_slide', intended_duration_seconds: 60 }),
        ]);

        for (const response of responses) {
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'A Screen may only report its own presentations' });
        }
    });

    test('rotating a device key revokes the previous key', async () => {
        const screen = await registerScreen(`device-rotated-${suffix}`);
        expect(screen.status).toBe(201);
        const screenId = screen.body.screen_id;

        const denied = await as('brand', request(app).post(`/api/screens/${screenId}/device-key`));
        expect(denied.status).toBe(403);

        const rotated = await as('techOperator', request(app).post(`/api/screens/${screenId}/device-key`));
        expect(rotated.status).toBe(200);
        expect(rotated.body).toEqual({
            screen_id: screenId,
            device_key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        });
        expect(rotated.body.device_key).not.toBe(screen.body.device_key);

        const withPreviousKey = await asDevice(request(app).post('/api/device/heartbeat'), screenId, screen.body.device_key);
        const withRotatedKey = await asDevice(request(app).post('/api/device/heartbeat'), screenId, rotated.body.device_key);
        expect(withPreviousKey.status).toBe(401);
        expect(withRotatedKey.status).toBe(200);

        const missing = await as('techOperator', request(app).post(`/api/screens/device-missing-${suffix}/device-key`));
        expect(missing.status).toBe(404);
    });

    test('the former user-token and public device endpoints are gone', async () => {
        const responses = await Promise.all([
            request(app).get('/api/screens/demo-screen-north-1/playback-loop'),
            as('techOperator', request(app).post('/api/screens/register')).send({ screen_id: `device-self-${suffix}` }),
            as('techOperator', request(app).post('/api/monitoring/heartbeat')).send({ screenId: 'demo-screen-north-1' }),
            as('techOperator', request(app).post('/api/telemetry/impression')).send({}),
            as('techOperator', request(app).post('/api/telemetry/playback-observation')).send({}),
        ]);

        expect(responses.map(response => response.status)).toEqual([404, 404, 404, 404, 404]);
    });
});

async function signIn(email, password) {
    const response = await fetch(
        `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
    );
    if (!response.ok) throw new Error(`Firebase emulator sign-in failed: ${await response.text()}`);
    return (await response.json()).idToken;
}
