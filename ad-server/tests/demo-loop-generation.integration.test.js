import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';
process.env.DEMO_ASSETS_BUCKET = process.env.DEMO_ASSETS_BUCKET
    || `${process.env.GOOGLE_CLOUD_PROJECT}.firebasestorage.app`;

jest.setTimeout(60_000);

const { describeWithAuthEmulator, signIn } = await import('./fixtures/emulator-sign-in.js');

describeWithAuthEmulator('loop generation on the demo baseline', () => {
    const targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let request;
    let app;
    let firestore;
    let admin;

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
        await provisionDemoPersonas({ password: 'Phase1-demo-password!', expectedProjectId: 'softomedia-demo' });
        admin = { Authorization: `Bearer ${await signIn('admin@demo.softomedia.test')}` };
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await firestore?.terminate();
    });

    test('an Admin generates a persisted loop for every default Store hour', async () => {
        const generated = await request(app).post('/api/loops/generate').set(admin).send({
            targetDate,
            retailerId: 'demo-retailer-freshmart',
            storeId: 'demo-store-mtl-north',
        });
        const listed = await request(app).get(`/api/loops?date=${targetDate}&store_id=demo-store-mtl-north`).set(admin);

        expect({ status: generated.status, body: generated.body.error ?? generated.body.business_hours })
            .toEqual({ status: 201, body: { start: 8, end: 22, is_closed: false, total_loops: 14 } });
        expect(listed.body.loops.map(loop => loop.hour).sort((a, b) => a - b))
            .toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    });
});
