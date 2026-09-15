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

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from('media access creative')]);

// supertest buffers an image/png response body.
const binary = pending => pending.buffer(true).parse((response, done) => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => done(null, Buffer.concat(chunks)));
});

/**
 * Uploaded media is private: files are read only through the API, by the
 * people and Screens allowed to see them.
 */
describeWithEmulators('media access with Firebase emulators', () => {
    let request;
    let app;
    let firestore;
    let storage;
    const tokens = {};
    const createdMediaIds = [];

    const as = (persona, pending) => pending.set('Authorization', `Bearer ${tokens[persona]}`);

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        const { Storage } = await import('@google-cloud/storage');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

        const { resetDemoBaseline } = await import('../src/services/DemoResetService.js');
        await resetDemoBaseline({
            firestore,
            storage,
            activeProjectId: process.env.GOOGLE_CLOUD_PROJECT,
            expectedProjectId: 'softomedia-demo',
            bucketName: process.env.DEMO_ASSETS_BUCKET,
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
        });

        const { provisionDemoPersonas } = await import('../src/services/DemoPersonaProvisioner.js');
        await provisionDemoPersonas({ password: PASSWORD, expectedProjectId: 'softomedia-demo' });
        const personas = {
            brand: 'brand@demo.softomedia.test',
            secondaryBrand: 'brand-secondary@demo.softomedia.test',
            admin: 'admin@demo.softomedia.test',
            retaileradmin: 'retaileradmin@demo.softomedia.test',
            secondaryRetailer: 'retaileradmin-secondary@demo.softomedia.test',
            techoperator: 'techoperator@demo.softomedia.test',
        };
        await Promise.all(Object.entries(personas).map(async ([persona, email]) => {
            tokens[persona] = await signIn(email);
        }));
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await Promise.all(createdMediaIds.map(id => firestore.collection('media').doc(id).delete()));
        await firestore?.terminate();
    });

    async function brandUpload(title) {
        const upload = await as('brand', request(app).post('/api/assets/upload'))
            .field('title', title)
            .field('category', 'paid')
            .field('duration', '5')
            .attach('file', PNG, { filename: 'creative.png', contentType: 'image/png' });
        expect(upload.status).toBe(201);
        createdMediaIds.push(upload.body.id);
        return upload.body;
    }

    test('the Brand that uploaded a creative reads its file through the API; no one reads it without signing in', async () => {
        const asset = await brandUpload('Private creative');

        const own = await binary(as('brand', request(app).get(`/api/assets/${asset.id}/content`)));
        expect(own.status).toBe(200);
        expect(own.headers['content-type']).toBe('image/png');
        expect(Buffer.compare(own.body, PNG)).toBe(0);

        const anonymous = await request(app).get(`/api/assets/${asset.id}/content`);
        expect(anonymous.status).toBe(401);
    });

    test('an uploaded creative carries its API content path, never a Storage URL', async () => {
        const asset = await brandUpload('Addressed creative');
        const listed = (await as('brand', request(app).get('/api/assets'))).body.find(({ id }) => id === asset.id);

        for (const record of [asset, listed]) {
            expect(record.content_path).toBe(`/api/assets/${asset.id}/content`);
            expect(record).not.toHaveProperty('url');
        }
    });

    test('another Brand and a Technical Operator cannot read a Brand\'s creative; Admin can', async () => {
        const asset = await brandUpload('Scoped creative');
        const path = `/api/assets/${asset.id}/content`;

        const [otherBrand, operator, admin] = await Promise.all([
            as('secondaryBrand', request(app).get(path)),
            as('techoperator', request(app).get(path)),
            binary(as('admin', request(app).get(path))),
        ]);

        expect([otherBrand.status, operator.status, admin.status]).toEqual([404, 404, 200]);
    });

    test('a Retailer reads the creative of a Campaign booked at its Stores, and no other Retailer does', async () => {
        const asset = await brandUpload('Creative under review');
        const campaignId = `media-access-campaign-${Date.now()}`;
        await firestore.collection('campaigns').doc(campaignId).set({
            name: 'Campaign under review',
            brand_id: 'demo-advertiser-bonvie',
            advertiser_id: 'demo-advertiser-bonvie',
            media_id: asset.id,
            status: 'pending_approval',
            inventory_selection: [{
                retailer_id: 'demo-retailer-freshmart',
                store_id: 'demo-store-mtl-north',
                location_id: 'demo-location-mtl-checkout',
                screen_id: 'demo-screen-north-1',
            }],
        });

        try {
            const path = `/api/assets/${asset.id}/content`;
            const [reviewer, otherRetailer] = await Promise.all([
                binary(as('retaileradmin', request(app).get(path))),
                as('secondaryRetailer', request(app).get(path)),
            ]);
            expect([reviewer.status, otherRetailer.status]).toEqual([200, 404]);
        } finally {
            await firestore.collection('campaigns').doc(campaignId).delete();
        }
    });

    test('a Screen reads approved playback media with its device key, but not media awaiting approval', async () => {
        const screenId = `media-access-screen-${Date.now()}`;
        const registration = await as('techoperator', request(app).post('/api/screens')).send({
            screen_id: screenId,
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-entrance',
        });
        expect(registration.status).toBe(201);
        const device = { Authorization: `Device ${screenId}:${registration.body.device_key}` };

        try {
            const pending = await brandUpload('Creative awaiting approval');
            const [approved, awaiting, withoutKey] = await Promise.all([
                binary(request(app).get('/api/device/media/demo-media-fallback').set(device)),
                request(app).get(`/api/device/media/${pending.id}`).set(device),
                request(app).get('/api/device/media/demo-media-fallback'),
            ]);

            expect([approved.status, awaiting.status, withoutKey.status]).toEqual([200, 404, 401]);
            expect(approved.headers['content-type']).toBe('image/png');
        } finally {
            await firestore.collection('screens').doc(screenId).delete();
        }
    });
});
