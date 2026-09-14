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

describeWithEmulators('Support Ticket HTTP API with Firebase emulators', () => {
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
            retailer: 'retaileradmin@demo.softomedia.test',
            secondaryRetailer: 'retaileradmin-secondary@demo.softomedia.test',
            techOperator: 'techoperator@demo.softomedia.test',
            superAdmin: 'superadmin@demo.softomedia.test',
            admin: 'admin@demo.softomedia.test',
            brand: 'brand@demo.softomedia.test',
        };
        await Promise.all(Object.entries(personas).map(async ([persona, email]) => {
            tokens[persona] = await signIn(email, password);
        }));
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await firestore?.terminate();
    });

    test('Retailer Administrator creates a Support Ticket for its organization and views it', async () => {
        const created = await as('retailer', request(app).post('/api/tickets')).send({
            subject: 'Entrance screen is blank',
            category: 'hardware',
            description: 'The entrance screen went dark shortly after opening.',
        });

        expect(created.status).toBe(201);
        expect(created.body).toEqual(expect.objectContaining({
            id: expect.any(String),
            retailer_id: 'demo-retailer-freshmart',
            subject: 'Entrance screen is blank',
            category: 'hardware',
            description: 'The entrance screen went dark shortly after opening.',
            status: 'open',
            notes: [],
        }));

        const viewed = await as('retailer', request(app).get(`/api/tickets/${created.body.id}`));
        expect(viewed.status).toBe(200);
        expect(viewed.body).toEqual(created.body);

        const listed = await as('retailer', request(app).get('/api/tickets'));
        expect(listed.status).toBe(200);
        expect(listed.body).toEqual([created.body]);
    });

    test('Technical Operator updates Support Tickets across the network while the Retailer Administrator only views them', async () => {
        const [primary, secondary] = await Promise.all([
            as('retailer', request(app).post('/api/tickets')).send({
                subject: 'Checkout screen lost Wi-Fi',
                category: 'network',
                description: 'The checkout screen shows a disconnected icon.',
            }),
            as('secondaryRetailer', request(app).post('/api/tickets')).send({
                subject: 'Loop is out of sync',
                category: 'content_sync',
                description: 'The entrance screen repeats the same advertisement.',
            }),
        ]);
        expect([primary.status, secondary.status]).toEqual([201, 201]);

        const network = await as('techOperator', request(app).get('/api/tickets'));
        expect(network.status).toBe(200);
        expect(network.body.map(ticket => ticket.id)).toEqual(
            expect.arrayContaining([primary.body.id, secondary.body.id]),
        );

        const updated = await as('techOperator', request(app).patch(`/api/tickets/${secondary.body.id}`)).send({
            status: 'in_progress',
            note: 'Technician is reloading the player schedule.',
        });
        expect(updated.status).toBe(200);
        expect(updated.body).toEqual(expect.objectContaining({
            id: secondary.body.id,
            retailer_id: 'demo-retailer-secondary',
            status: 'in_progress',
            notes: [expect.objectContaining({
                body: 'Technician is reloading the player schedule.',
                author_role: 'techoperator',
                created_at: expect.any(String),
            })],
        }));

        const retailerView = await as('secondaryRetailer', request(app).get(`/api/tickets/${secondary.body.id}`));
        expect(retailerView.status).toBe(200);
        expect(retailerView.body).toEqual(updated.body);

        const retailerUpdate = await as('secondaryRetailer', request(app).patch(`/api/tickets/${secondary.body.id}`))
            .send({ status: 'resolved' });
        expect(retailerUpdate.status).toBe(403);
        expect(retailerUpdate.body).toEqual({ error: 'Access denied' });
    });

    test('Super Administrator views and resolves any Support Ticket', async () => {
        const reported = await as('secondaryRetailer', request(app).post('/api/tickets')).send({
            subject: 'Screen flickers during loop changes',
            category: 'hardware',
            description: 'The display flickers at the top of every hour.',
        });
        expect(reported.status).toBe(201);

        const all = await as('superAdmin', request(app).get('/api/tickets'));
        expect(all.status).toBe(200);
        expect(all.body.map(ticket => ticket.id)).toContain(reported.body.id);

        const resolved = await as('superAdmin', request(app).patch(`/api/tickets/${reported.body.id}`)).send({
            status: 'resolved',
            note: 'Replaced the display cable.',
        });
        expect(resolved.status).toBe(200);
        expect(resolved.body).toEqual(expect.objectContaining({
            status: 'resolved',
            notes: [expect.objectContaining({ body: 'Replaced the display cable.', author_role: 'superadmin' })],
        }));

        const viewed = await as('superAdmin', request(app).get(`/api/tickets/${reported.body.id}`));
        expect(viewed.status).toBe(200);
        expect(viewed.body).toEqual(resolved.body);
    });

    test.each(['admin', 'brand'])('%s receives an exact denial for every Support Ticket action', async persona => {
        const existing = await as('retailer', request(app).post('/api/tickets')).send({
            subject: 'Entrance screen reboots',
            category: 'hardware',
            description: 'The entrance screen restarts every few minutes.',
        });
        expect(existing.status).toBe(201);

        const responses = await Promise.all([
            as(persona, request(app).get('/api/tickets')),
            as(persona, request(app).post('/api/tickets')).send({
                subject: 'Not permitted',
                category: 'network',
                description: 'This persona has no Support Ticket access.',
            }),
            as(persona, request(app).get(`/api/tickets/${existing.body.id}`)),
            as(persona, request(app).patch(`/api/tickets/${existing.body.id}`)).send({ status: 'resolved' }),
        ]);
        for (const response of responses) {
            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Access denied' });
        }

        const unchanged = await as('retailer', request(app).get(`/api/tickets/${existing.body.id}`));
        expect(unchanged.body.status).toBe('open');
    });

    test('Retailer Administrator cannot discover or read another Retailer\'s Support Tickets', async () => {
        const foreign = await as('retailer', request(app).post('/api/tickets')).send({
            subject: 'Private FreshMart incident',
            category: 'network',
            description: 'Only FreshMart and operations staff may read this.',
        });
        expect(foreign.status).toBe(201);

        const ownList = await as('secondaryRetailer', request(app).get('/api/tickets'));
        expect(ownList.status).toBe(200);
        expect(ownList.body.length).toBeGreaterThan(0);
        expect(ownList.body.every(ticket => ticket.retailer_id === 'demo-retailer-secondary')).toBe(true);

        const foreignRead = await as('secondaryRetailer', request(app).get(`/api/tickets/${foreign.body.id}`));
        const missingRead = await as('secondaryRetailer', request(app).get('/api/tickets/no-such-ticket'));
        expect(foreignRead.status).toBe(403);
        expect(foreignRead.body).toEqual({ error: 'Access denied' });
        expect(missingRead.status).toBe(foreignRead.status);
        expect(missingRead.body).toEqual(foreignRead.body);
    });

    test('rejects incomplete Support Tickets and updates without persisting them', async () => {
        const before = await as('retailer', request(app).get('/api/tickets'));

        const incomplete = await as('retailer', request(app).post('/api/tickets')).send({
            subject: '   ',
            category: 'printer',
        });
        expect(incomplete.status).toBe(400);
        expect(incomplete.body).toEqual({
            error: 'Invalid Support Ticket',
            fields: ['subject', 'category', 'description'],
        });

        const after = await as('retailer', request(app).get('/api/tickets'));
        expect(after.body).toEqual(before.body);

        const ticketId = before.body[0].id;
        const unknownStatus = await as('techOperator', request(app).patch(`/api/tickets/${ticketId}`))
            .send({ status: 'closed-forever' });
        expect(unknownStatus.status).toBe(400);
        expect(unknownStatus.body).toEqual({ error: 'Invalid Support Ticket update', fields: ['status'] });

        const emptyUpdate = await as('techOperator', request(app).patch(`/api/tickets/${ticketId}`)).send({ note: '' });
        expect(emptyUpdate.status).toBe(400);
        expect(emptyUpdate.body).toEqual({ error: 'Invalid Support Ticket update', fields: ['status', 'note'] });

        const unchanged = await as('techOperator', request(app).get(`/api/tickets/${ticketId}`));
        expect(unchanged.body).toEqual(before.body[0]);
    });

    test('the removed AI service exposes no endpoints', async () => {
        const responses = await Promise.all([
            request(app).post('/ghost-api/analyze').send({ steps: [{ url: 'http://localhost/dashboard' }] }),
            request(app).get('/ghost-api/tickets'),
            request(app).post('/ghost-api/tickets').send({ subject: 'AI ticket' }),
            request(app).get('/ghost-api/tickets/demo-ticket-001'),
            request(app).get('/ghost-api/admin/logs'),
            request(app).get('/ghost-api/admin/stats'),
            as('superAdmin', request(app).post('/api/ai-log')).send({ type: 'broken_route' }),
        ]);

        expect(responses.map(response => response.status)).toEqual([404, 404, 404, 404, 404, 404, 404]);
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
