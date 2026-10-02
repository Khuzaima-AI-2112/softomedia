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

const { PASSWORD, signIn } = await import('./fixtures/emulator-sign-in.js');

jest.setTimeout(30_000);

/**
 * Nobody approves a Campaign (ADR 0007): a Retailer approves the Creative for
 * its own Stores instead, so it has no Campaign access. A Campaign's status
 * changes only when it is cancelled.
 */
describeWithEmulators('Campaign Retailer scope with Firebase emulators', () => {
    let request;
    let app;
    let firestore;
    const tokens = {};
    const createdCampaignIds = [];

    const as = (persona, pending) => pending.set('Authorization', `Bearer ${tokens[persona]}`);

    async function seedCampaign(id, fields) {
        createdCampaignIds.push(id);
        await firestore.collection('campaigns').doc(id).set({
            name: `Scope fixture ${id}`,
            advertiser_id: 'demo-advertiser-secondary',
            status: 'scheduled',
            budget: 5000,
            start_date: '2030-02-01',
            end_date: '2030-02-14',
            ...fields,
        });
    }

    const statusOf = async id => (await firestore.collection('campaigns').doc(id).get()).data().status;

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
        await provisionDemoPersonas({ password: PASSWORD, expectedProjectId: 'softomedia-demo' });
        const personas = {
            superadmin: 'superadmin@demo.softomedia.test',
            admin: 'admin@demo.softomedia.test',
            retaileradmin: 'retaileradmin@demo.softomedia.test',
            secondaryRetailer: 'retaileradmin-secondary@demo.softomedia.test',
            techoperator: 'techoperator@demo.softomedia.test',
        };
        await Promise.all(Object.entries(personas).map(async ([persona, email]) => {
            tokens[persona] = await signIn(email);
        }));

        await seedCampaign('scope-secondary-stores', {
            inventory_selection: [{
                retailer_id: 'demo-retailer-secondary',
                store_id: 'demo-store-phoenix',
                location_id: 'demo-location-phoenix-entrance',
                screen_id: 'demo-screen-phoenix-1',
            }],
        });

        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await Promise.all(createdCampaignIds.map(id => firestore.collection('campaigns').doc(id).delete()));
        await firestore?.terminate();
    });

    test('nobody approves or rejects a Campaign: the status route is gone for every persona', async () => {
        const attempts = {};
        for (const persona of ['superadmin', 'admin', 'retaileradmin', 'secondaryRetailer', 'techoperator']) {
            attempts[persona] = (await as(persona, request(app).patch('/api/campaigns/scope-secondary-stores/status'))
                .send({ status: 'approved' })).status;
        }

        expect(attempts).toEqual({
            superadmin: 404, admin: 404, retaileradmin: 404, secondaryRetailer: 404, techoperator: 404,
        });
        expect(await statusOf('scope-secondary-stores')).toBe('scheduled');
    });

    test('no one changes a Campaign\'s status by editing it', async () => {
        await seedCampaign('scope-edit-status', { retailer_id: 'demo-retailer-freshmart' });

        const attempts = {};
        for (const persona of ['superadmin', 'admin', 'retaileradmin', 'techoperator']) {
            attempts[persona] = (await as(persona, request(app).put('/api/campaigns/scope-edit-status'))
                .send({ name: 'Edited', status: 'cancelled' })).status;
        }

        expect(attempts).toEqual({ superadmin: 400, admin: 400, retaileradmin: 403, techoperator: 403 });
        expect(await statusOf('scope-edit-status')).toBe('scheduled');

        const edit = await as('admin', request(app).put('/api/campaigns/scope-edit-status')).send({ name: 'Edited' });
        expect(edit.status).toBe(200);
        expect(edit.body).toMatchObject({ name: 'Edited', status: 'scheduled' });
    });

    test('moving a Campaign to other Stores or swapping its creative leaves it scheduled', async () => {
        await seedCampaign('scope-edit-retarget', {
            media_id: 'demo-media-paid',
            inventory_selection: [{
                retailer_id: 'demo-retailer-freshmart',
                store_id: 'demo-store-mtl-north',
                location_id: 'demo-location-mtl-checkout',
                screen_id: 'demo-screen-north-1',
            }],
        });

        const moved = await as('admin', request(app).put('/api/campaigns/scope-edit-retarget')).send({
            inventory_selection: [{
                retailer_id: 'demo-retailer-secondary',
                store_id: 'demo-store-phoenix',
                location_id: 'demo-location-phoenix-entrance',
                screen_id: 'demo-screen-phoenix-1',
            }],
        });
        const swapped = await as('superadmin', request(app).put('/api/campaigns/scope-edit-retarget'))
            .send({ media_id: 'demo-media-internal' });

        expect([moved.status, swapped.status]).toEqual([200, 200]);
        expect(swapped.body).toMatchObject({ media_id: 'demo-media-internal', status: 'scheduled' });
        expect(await statusOf('scope-edit-retarget')).toBe('scheduled');
    });

    test('an Admin edits only a Campaign\'s editable fields', async () => {
        await seedCampaign('scope-edit-allowlist', {
            media_id: 'demo-media-paid',
            retailer_id: 'demo-retailer-freshmart',
            created_at: '2030-01-10T00:00:00.000Z',
        });

        const edit = await as('admin', request(app).put('/api/campaigns/scope-edit-allowlist')).send({
            name: 'Renamed',
            end_date: '2030-02-20',
            retailer_id: 'demo-retailer-freshmart',
            advertiser_id: 'demo-advertiser-bonvie',
            created_at: '1999-01-01T00:00:00.000Z',
            approved_by: 'someone',
        });

        expect(edit.status).toBe(200);
        const saved = (await firestore.collection('campaigns').doc('scope-edit-allowlist').get()).data();
        expect(saved).toMatchObject({
            name: 'Renamed',
            end_date: '2030-02-20',
            status: 'scheduled',
            advertiser_id: 'demo-advertiser-secondary',
            created_at: '2030-01-10T00:00:00.000Z',
        });
        expect(saved).not.toHaveProperty('approved_by');
    });

    test('a Campaign an Admin prepares is scheduled whatever status is sent', async () => {
        const created = await as('admin', request(app).post('/api/campaigns')).send({
            id: 'scope-admin-prepared',
            name: 'Admin prepared',
            advertiser_id: 'demo-advertiser-bonvie',
            retailer_id: 'demo-retailer-freshmart',
            status: 'cancelled',
        });
        createdCampaignIds.push('scope-admin-prepared');

        expect(created.status).toBe(201);
        expect(await statusOf('scope-admin-prepared')).toBe('scheduled');
    });

    test('a Retailer Administrator and a Technical Operator have no Campaign access', async () => {
        await seedCampaign('scope-freshmart-stores', {
            inventory_selection: [{
                retailer_id: 'demo-retailer-freshmart',
                store_id: 'demo-store-mtl-north',
                location_id: 'demo-location-mtl-checkout',
                screen_id: 'demo-screen-north-1',
            }],
        });

        const responses = await Promise.all(['retaileradmin', 'techoperator'].flatMap(persona => [
            as(persona, request(app).get('/api/campaigns')),
            as(persona, request(app).get('/api/campaigns/scope-freshmart-stores')),
        ]));

        expect(responses.map(response => response.status)).toEqual([403, 403, 403, 403]);
        expect(JSON.stringify(responses.map(response => response.body))).not.toContain('Scope fixture');
    });

    test('Campaigns reach loops only through loop generation, not direct slot booking', async () => {
        const statuses = {};
        for (const persona of ['superadmin', 'admin', 'retaileradmin', 'techoperator']) {
            statuses[persona] = (await as(persona, request(app).post('/api/campaigns/scope-freshmart-stores/book'))
                .send({ slots: [{ loopId: 'demo-loop-mtl-next-day-08', slotIndex: 0 }] })).status;
        }

        expect(statuses).toEqual({ superadmin: 404, admin: 404, retaileradmin: 404, techoperator: 404 });
        const loop = await firestore.collection('loops').doc('demo-loop-mtl-next-day-08').get();
        expect(JSON.stringify(loop.data().slots)).not.toContain('scope-freshmart-stores');
    });
});
