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

/**
 * The accepted Phase 1 permission matrix (docs/phase-1-demo-acceptance.md),
 * exercised through real Firebase sign-in. Authority is an explicit grant,
 * never inferred from one role ranking above another.
 */
describeWithEmulators('Phase 1 permission matrix with Firebase emulators', () => {
    const password = 'Phase1-demo-password!';
    let request;
    let app;
    let firestore;
    const tokens = {};

    const as = (persona, pending) => pending.set('Authorization', `Bearer ${tokens[persona]}`);

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
            superadmin: 'superadmin@demo.softomedia.test',
            admin: 'admin@demo.softomedia.test',
            brand: 'brand@demo.softomedia.test',
            retaileradmin: 'retaileradmin@demo.softomedia.test',
            techoperator: 'techoperator@demo.softomedia.test',
        };
        await Promise.all(Object.entries(personas).map(async ([persona, email]) => {
            tokens[persona] = await signIn(email, password);
        }));
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await firestore?.terminate();
    });

    test('Technical Operator lists Stores network-wide to register and assign Screens', async () => {
        const response = await as('techoperator', request(app).get('/api/stores'));

        expect(response.status).toBe(200);
        expect(response.body.map(({ id }) => id)).toEqual(expect.arrayContaining([
            'demo-store-mtl-north',
            'demo-store-phoenix',
        ]));
    });

    test.each(['superadmin', 'admin', 'techoperator', 'brand'])(
        '%s cannot approve or reject content on a Retailer\'s behalf',
        async persona => {
            const attempts = [
                as(persona, request(app).patch('/api/campaigns/matrix-campaign/status')).send({ status: 'approved' }),
                as(persona, request(app).patch('/api/loops/matrix-loop/approve')).send({}),
                as(persona, request(app).post('/api/loops/matrix-loop/reject')).send({ reason: 'matrix' }),
                as(persona, request(app).patch('/api/loops/matrix-loop/slots/0/reject')).send({ reason: 'matrix' }),
            ];
            const statuses = (await Promise.all(attempts)).map(response => response.status);
            expect(statuses).toEqual([403, 403, 403, 403]);
        },
    );
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
