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

    test('Admin lists the demo Advertisers a Campaign is prepared for', async () => {
        const advertisers = await as('admin', request(app).get('/api/advertisers'));

        expect(advertisers.status).toBe(200);
        expect(advertisers.body.map(({ id }) => id)).toEqual(expect.arrayContaining([
            'demo-advertiser-bonvie',
            'demo-advertiser-secondary',
        ]));
    });

    test('the signed-in profile carries the explicit grants the client gates its actions on', async () => {
        const [retailer, operator] = await Promise.all([
            as('retaileradmin', request(app).get('/api/auth/me')),
            as('techoperator', request(app).get('/api/auth/me')),
        ]);

        expect(retailer.body.user.permissions).toEqual(expect.arrayContaining(['campaigns.approve']));
        expect(retailer.body.user.permissions).not.toContain('screens.manage');
        expect(operator.body.user.permissions).toEqual(expect.arrayContaining(['screens.manage', 'screens.diagnostics']));
        expect(operator.body.user.permissions).not.toContain('campaigns.approve');
    });

    test('Technical Operator lists Retailers, Stores and Locations network-wide to register and assign Screens', async () => {
        const [retailers, stores, locations] = await Promise.all([
            as('techoperator', request(app).get('/api/retailers')),
            as('techoperator', request(app).get('/api/stores')),
            as('techoperator', request(app).get('/api/locations')),
        ]);

        expect(retailers.status).toBe(200);
        expect(retailers.body.map(({ id }) => id)).toEqual(expect.arrayContaining([
            'demo-retailer-freshmart',
            'demo-retailer-secondary',
        ]));
        expect(stores.status).toBe(200);
        expect(stores.body.map(({ id }) => id)).toEqual(expect.arrayContaining([
            'demo-store-mtl-north',
            'demo-store-phoenix',
        ]));
        expect(locations.status).toBe(200);
        expect(locations.body.map(({ id }) => id)).toEqual(expect.arrayContaining([
            'demo-location-mtl-checkout',
            'demo-location-phoenix-entrance',
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

    // Each request is shaped so a permitted persona gets a known non-denial
    // outcome (usually a validation or not-found response) without side effects.
    const GRANTS = [
        {
            action: 'manage Retailer organizations',
            send: pending => pending.patch('/api/retailers/matrix-retailer').send({}),
            allowed: { superadmin: 400 },
        },
        {
            action: 'manage Advertiser organizations',
            send: pending => pending.patch('/api/advertisers/matrix-advertiser').send({}),
            allowed: { superadmin: 400 },
        },
        {
            action: 'read Screen diagnostics logs',
            send: pending => pending.get('/api/screens/matrix-screen/logs'),
            allowed: { techoperator: 404, superadmin: 404 },
        },
        {
            action: 'read network monitoring status',
            send: pending => pending.get('/api/monitoring/status'),
            allowed: { techoperator: 200, superadmin: 200 },
        },
        {
            action: 'record an operations audit entry',
            send: pending => pending.post('/api/audit').send({}),
            allowed: { techoperator: 400, superadmin: 400 },
        },
        {
            action: 'create a Campaign',
            send: pending => pending.post('/api/campaigns').send({}),
            allowed: { brand: 400, admin: 400, superadmin: 400 },
        },
        {
            action: 'generate an invoice',
            send: pending => pending.post('/api/invoices/generate').send({}),
            allowed: { admin: 400, superadmin: 400 },
        },
        {
            action: 'query delivery impressions',
            send: pending => pending.get('/api/impressions'),
            allowed: { admin: 400, superadmin: 400, retaileradmin: 400 },
        },
    ];
    const PERSONAS = ['superadmin', 'admin', 'brand', 'retaileradmin', 'techoperator'];

    test.each(GRANTS)('only the granted personas may $action', async ({ send, allowed }) => {
        const expected = Object.fromEntries(PERSONAS.map(persona => [persona, allowed[persona] ?? 403]));
        const actual = {};
        for (const persona of PERSONAS) {
            actual[persona] = (await as(persona, send(request(app)))).status;
        }
        expect(actual).toEqual(expected);
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
