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

const { PASSWORD, signIn, signInAs } = await import('./fixtures/emulator-sign-in.js');
const { VALID_PNG } = await import('./fixtures/media-files.js');

jest.setTimeout(30_000);

/**
 * A Brand's upload is a Creative: a record of its file(s) with an approval
 * status. Approval belongs to the Creative, and no role is granted it yet.
 */
describeWithEmulators('Creatives with Firebase emulators', () => {
    let request;
    let app;
    let firestore;
    const tokens = {};
    const createdMediaIds = [];
    const createdCreativeIds = [];

    const as = (persona, pending) => pending.set('Authorization', `Bearer ${tokens[persona]}`);

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        const { Storage } = await import('@google-cloud/storage');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        const storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

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
            superadmin: 'superadmin@demo.softomedia.test',
            admin: 'admin@demo.softomedia.test',
            brand: 'brand@demo.softomedia.test',
            secondaryBrand: 'brand-secondary@demo.softomedia.test',
            retaileradmin: 'retaileradmin@demo.softomedia.test',
            techoperator: 'techoperator@demo.softomedia.test',
        };
        await Promise.all(Object.entries(personas).map(async ([persona, email]) => {
            tokens[persona] = await signIn(email);
        }));
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await Promise.all(createdMediaIds.map(id => firestore.collection('media').doc(id).delete()));
        await Promise.all(createdCreativeIds.map(id => firestore.collection('creatives').doc(id).delete()));
        await firestore?.terminate();
    });

    async function brandUpload(title, persona = 'brand') {
        const upload = await as(persona, request(app).post('/api/assets/upload'))
            .field('title', title)
            .field('category', 'paid')
            .attach('file', VALID_PNG, { filename: 'creative.png', contentType: 'image/png' });
        expect(upload.status).toBe(201);
        createdMediaIds.push(upload.body.id);
        createdCreativeIds.push(upload.body.creative?.id);
        return upload.body;
    }

    const listCreatives = async persona => {
        const response = await as(persona, request(app).get('/api/creatives'));
        expect(response.status).toBe(200);
        return response.body;
    };

    test('a Brand upload creates a pending Creative that the Brand sees with its status', async () => {
        const asset = await brandUpload('Autumn latte');

        expect(asset.creative).toEqual({ id: expect.stringMatching(/^crv_/), approval_status: 'pending' });

        const creative = (await listCreatives('brand')).find(({ id }) => id === asset.creative.id);
        expect(creative).toMatchObject({
            brand_id: 'demo-advertiser-bonvie',
            approval_status: 'pending',
            decided_by: null,
            decided_at: null,
            reason: null,
            files: [{ id: asset.id, title: 'Autumn latte', content_path: `/api/assets/${asset.id}/content` }],
        });

        // The file, listed in the media library, carries its Creative's status.
        const library = await as('brand', request(app).get('/api/assets'));
        expect(library.body.find(({ id }) => id === asset.id))
            .toMatchObject({ creative: { id: asset.creative.id, approval_status: 'pending' } });

        // Another Brand never sees it.
        const others = await listCreatives('secondaryBrand');
        expect(others.map(({ id }) => id)).not.toContain(asset.creative.id);
    });

    test('uploading the same file again makes a new Creative', async () => {
        const first = await brandUpload('Same file');
        const second = await brandUpload('Same file');

        expect(second.creative.id).not.toBe(first.creative.id);
        const mine = (await listCreatives('brand')).map(({ id }) => id);
        expect(mine).toEqual(expect.arrayContaining([first.creative.id, second.creative.id]));
    });

    test.each(['approve', 'reject', 'revoke'])('no role may %s a Creative yet', async action => {
        const asset = await brandUpload(`Nobody can ${action} this`);

        for (const persona of ['superadmin', 'admin', 'brand', 'retaileradmin', 'techoperator']) {
            const response = await as(persona, request(app).post(`/api/creatives/${asset.creative.id}/${action}`))
                .send({ reason: 'Not on brand' });
            expect({ persona, status: response.status }).toEqual({ persona, status: 403 });
        }

        const [creative] = (await listCreatives('brand')).filter(({ id }) => id === asset.creative.id);
        expect(creative.approval_status).toBe('pending');
    });

    test('whoever holds the Creative-approval grant approves, rejects with a reason, and revokes', async () => {
        const { uid, headers } = await signInAs('superadmin', { permissions: ['creatives.approve'] });
        const decide = (creativeId, action, body = {}) => request(app)
            .post(`/api/creatives/${creativeId}/${action}`).set(headers).send(body);

        const approved = await brandUpload('Approve me');
        const approval = await decide(approved.creative.id, 'approve');
        expect(approval.status).toBe(200);
        expect(approval.body).toMatchObject({
            id: approved.creative.id, approval_status: 'approved', decided_by: uid, reason: null,
        });
        expect(Date.parse(approval.body.decided_at)).not.toBeNaN();

        const revocation = await decide(approved.creative.id, 'revoke', { reason: 'Offer has ended' });
        expect(revocation.status).toBe(200);
        expect(revocation.body).toMatchObject({ approval_status: 'revoked', reason: 'Offer has ended' });

        const rejected = await brandUpload('Reject me');
        const noReason = await decide(rejected.creative.id, 'reject');
        expect(noReason.status).toBe(400);
        const rejection = await decide(rejected.creative.id, 'reject', { reason: 'Logo is cropped' });
        expect(rejection.status).toBe(200);

        // The Brand sees each decision and its reason.
        const mine = await listCreatives('brand');
        expect(mine.find(({ id }) => id === rejected.creative.id))
            .toMatchObject({ approval_status: 'rejected', reason: 'Logo is cropped', decided_by: uid });
        expect(mine.find(({ id }) => id === approved.creative.id))
            .toMatchObject({ approval_status: 'revoked', reason: 'Offer has ended' });

        // Only a pending Creative is approved or rejected, and only an approved one revoked.
        expect((await decide(rejected.creative.id, 'approve')).status).toBe(409);
        expect((await decide(rejected.creative.id, 'revoke', { reason: 'x' })).status).toBe(409);
        expect((await decide('crv_missing', 'approve')).status).toBe(404);
    });

    test('two decisions on one pending Creative at once: exactly one wins', async () => {
        const { headers } = await signInAs('superadmin', { permissions: ['creatives.approve'] });
        const asset = await brandUpload('Contested');
        const decide = (action, body = {}) => request(app)
            .post(`/api/creatives/${asset.creative.id}/${action}`).set(headers).send(body);

        const [approval, rejection] = await Promise.all([
            decide('approve'), decide('reject', { reason: 'Logo is cropped' }),
        ]);

        expect([approval.status, rejection.status].sort()).toEqual([200, 409]);
        const winner = approval.status === 200 ? 'approved' : 'rejected';
        const stored = await firestore.collection('creatives').doc(asset.creative.id).get();
        expect(stored.data().approval_status).toBe(winner);
    });
});
