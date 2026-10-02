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
const { mediaAttachment, mediaFile, VALID_PNG } = await import('./fixtures/media-files.js');

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
    const createdCampaignIds = [];

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
        await Promise.all(createdCreativeIds.map(id => firestore.collection('creatives').doc(id).delete()));
        await Promise.all(createdCampaignIds.map(id => firestore.collection('campaigns').doc(id).delete()));
        await firestore?.terminate();
    });

    async function brandUpload(title, persona = 'brand') {
        const upload = await as(persona, request(app).post('/api/assets/upload'))
            .field('title', title)
            .field('category', 'paid')
            .attach('file', VALID_PNG, { filename: 'creative.png', contentType: 'image/png' });
        expect(upload.status).toBe(201);
        createdMediaIds.push(upload.body.id);
        if (upload.body.creative) createdCreativeIds.push(upload.body.creative.id);
        return upload.body;
    }

    const listCreatives = async persona => {
        const response = await as(persona, request(app).get('/api/creatives'));
        expect(response.status).toBe(200);
        return response.body;
    };

    test('a Brand upload creates a pending Creative that the Brand sees with its status', async () => {
        const asset = await brandUpload('Autumn latte');

        expect(asset.creative).toEqual({
            id: expect.stringMatching(/^crv_/), approval_status: 'pending', media_ids: [asset.id],
        });

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

    const decide = (persona, creativeId, action, body = {}) =>
        as(persona, request(app).post(`/api/creatives/${creativeId}/${action}`)).send(body);

    test.each(['approve', 'reject', 'revoke'])('Admin, Brand and Technical Operator may not %s a Creative', async action => {
        const asset = await brandUpload(`Nobody else can ${action} this`);

        for (const persona of ['admin', 'brand', 'secondaryBrand', 'techoperator']) {
            const response = await decide(persona, asset.creative.id, action, { reason: 'Not on brand' });
            expect({ persona, status: response.status }).toEqual({ persona, status: 403 });
        }

        const [creative] = (await listCreatives('brand')).filter(({ id }) => id === asset.creative.id);
        expect(creative.approval_status).toBe('pending');
    });

    test('the Super Administrator approves a pending Creative, or rejects it with a reason the Brand sees', async () => {
        const approved = await brandUpload('Super Admin approves');
        const approval = await decide('superadmin', approved.creative.id, 'approve');
        expect(approval.status).toBe(200);
        expect(approval.body).toMatchObject({ approval_status: 'approved', reason: null });

        const rejected = await brandUpload('Super Admin rejects');
        expect((await decide('superadmin', rejected.creative.id, 'reject')).status).toBe(400);
        const rejection = await decide('superadmin', rejected.creative.id, 'reject', { reason: 'Logo is cropped' });
        expect(rejection.status).toBe(200);

        const mine = await listCreatives('brand');
        expect(mine.find(({ id }) => id === approved.creative.id)).toMatchObject({ approval_status: 'approved' });
        expect(mine.find(({ id }) => id === rejected.creative.id))
            .toMatchObject({ approval_status: 'rejected', reason: 'Logo is cropped' });
    });

    const FRESHMART = 'demo-retailer-freshmart';
    const HARBORCART = 'demo-retailer-secondary';

    /** A Campaign of the Brand's that books its Creative in these Retailers' Stores. */
    async function bookIn(creativeId, retailerIds) {
        const id = `cmp_creative_${createdCampaignIds.length}_${Date.now()}`;
        createdCampaignIds.push(id);
        await firestore.collection('campaigns').doc(id).set({
            name: 'Approval booking', type: 'paid', status: 'pending_approval',
            brand_id: 'demo-advertiser-bonvie', advertiser_id: 'demo-advertiser-bonvie', creative_id: creativeId,
            inventory_selection: retailerIds.map(retailerId => ({ retailer_id: retailerId })),
        });
    }

    const notificationsFor = async persona => {
        const response = await as(persona, request(app).get('/api/notifications'));
        expect(response.status).toBe(200);
        return response.body;
    };

    test('the approvers are told in the app when a Creative waits for them', async () => {
        const title = `Pumpkin muffin ${Date.now()}`;
        const asset = await brandUpload(title);
        const awaiting = expect.objectContaining({
            title: 'Creative awaiting approval',
            message: `“${title}” from BonVie Synthetic Brand is waiting for your approval.`,
            read: false,
        });

        // The Super Administrator, as soon as it is uploaded.
        expect(await notificationsFor('superadmin')).toEqual(expect.arrayContaining([awaiting]));

        // Each Retailer it is booked with, once the Super Administrator has approved it.
        await bookIn(asset.creative.id, [FRESHMART]);
        expect(await notificationsFor('retaileradmin')).not.toEqual(expect.arrayContaining([awaiting]));
        expect((await decide('superadmin', asset.creative.id, 'approve')).status).toBe(200);
        expect(await notificationsFor('retaileradmin')).toEqual(expect.arrayContaining([awaiting]));
        expect(await notificationsFor('secondaryRetailer')).not.toEqual(expect.arrayContaining([awaiting]));

        // The Retailer finds it waiting on its decision, with every file to preview.
        const waiting = (await listCreatives('retaileradmin')).find(({ id }) => id === asset.creative.id);
        expect(waiting).toMatchObject({
            title,
            awaits_your_decision: true,
            files: [{ id: asset.id, mime_type: 'image/png', content_path: `/api/assets/${asset.id}/content` }],
            retailer_approvals: [expect.objectContaining({ retailer_id: FRESHMART, status: 'pending' })],
        });
        const preview = await as('retaileradmin', request(app).get(`/api/assets/${asset.id}/content`));
        expect(preview.status).toBe(200);
        // Another Retailer never sees it.
        expect((await listCreatives('secondaryRetailer')).map(({ id }) => id)).not.toContain(asset.creative.id);
    });

    test('each Retailer whose Stores book the Creative approves it for them, after the Super Administrator', async () => {
        const asset = await brandUpload('Two Retailers');
        const creativeId = asset.creative.id;
        await bookIn(creativeId, [FRESHMART]);
        await bookIn(creativeId, [HARBORCART]);

        // The Super Administrator decides first.
        const early = await decide('retaileradmin', creativeId, 'approve');
        expect(early.status).toBe(409);
        expect(early.body.error).toBe('The Super Administrator approves a Creative first');
        expect((await decide('superadmin', creativeId, 'approve')).status).toBe(200);

        const freshmart = await decide('retaileradmin', creativeId, 'approve');
        expect(freshmart.status).toBe(200);
        expect(freshmart.body.retailer_approvals).toEqual([
            expect.objectContaining({ retailer_id: FRESHMART, status: 'approved', reason: null }),
        ]);
        // Once per Retailer.
        expect((await decide('retaileradmin', creativeId, 'approve')).status).toBe(409);

        expect((await decide('secondaryRetailer', creativeId, 'reject')).status).toBe(400);
        const harborcart = await decide('secondaryRetailer', creativeId, 'reject', { reason: 'Not for our shoppers' });
        expect(harborcart.status).toBe(200);

        // A Retailer with no booking of the Creative can't see it to decide.
        const { headers } = await signInAs('retaileradmin', { organizationId: 'retailer-without-bookings' });
        const unbooked = await request(app).post(`/api/creatives/${creativeId}/approve`).set(headers);
        expect(unbooked.status).toBe(404);
        // Revoking stays with the Super Administrator.
        expect((await decide('retaileradmin', creativeId, 'revoke', { reason: 'x' })).status).toBe(403);

        // The Brand sees each Retailer's decision, and the reason for a rejection.
        const mine = (await listCreatives('brand')).find(({ id }) => id === creativeId);
        expect(mine.approval_status).toBe('approved');
        expect(mine.retailer_approvals).toEqual([
            expect.objectContaining({
                retailer_id: FRESHMART, retailer_name: 'FreshMart Synthetic Retailer', status: 'approved', reason: null,
            }),
            expect.objectContaining({
                retailer_id: HARBORCART, retailer_name: 'HarborCart Synthetic Retailer',
                status: 'rejected', reason: 'Not for our shoppers',
            }),
        ]);
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
        const [creative] = (await listCreatives('brand')).filter(({ id }) => id === asset.creative.id);
        expect(creative.approval_status).toBe(winner);
    });

    /** Uploads these fixture files, in order, as one paid upload. */
    const multiFileUpload = (title, names, persona = 'brand') => {
        const pending = as(persona, request(app).post('/api/assets/upload'))
            .field('title', title)
            .field('category', 'paid');
        for (const name of names) pending.attach('file', mediaFile(name), mediaAttachment(name));
        return pending;
    };

    test.each([2, 3])('a Brand uploads a %s-file Creative, its files kept in order and approved as one', async count => {
        const names = ['frame-16x9.png', 'five-seconds-16x9.mp4', 'frame-16x9.jpg'].slice(0, count);
        const upload = await multiFileUpload('Breakfast story', names);

        expect(upload.status).toBe(201);
        const { creative } = upload.body;
        createdMediaIds.push(...creative.media_ids);
        createdCreativeIds.push(creative.id);
        expect(creative).toEqual({ id: expect.stringMatching(/^crv_/), approval_status: 'pending', media_ids: expect.any(Array) });
        expect(creative.media_ids).toHaveLength(count);
        expect(creative.media_ids[0]).toBe(upload.body.id);

        const listed = (await listCreatives('brand')).find(({ id }) => id === creative.id);
        expect(listed.files.map(({ id, title }) => ({ id, title }))).toEqual(creative.media_ids.map((id, index) => ({
            id, title: `Breakfast story (${index + 1} of ${count})`,
        })));
        // Every file belongs to the one Creative and is its own five-second media record.
        const files = await Promise.all(creative.media_ids.map(id => firestore.collection('media').doc(id).get()));
        expect(files.map(file => ({ creative_id: file.data().creative_id, filename: file.data().filename })))
            .toEqual(names.map(filename => ({ creative_id: creative.id, filename })));

        // Approving the Creative approves every file.
        const { headers } = await signInAs('superadmin', { permissions: ['creatives.approve'] });
        const approval = await request(app).post(`/api/creatives/${creative.id}/approve`).set(headers);
        expect(approval.status).toBe(200);
        expect(approval.body.files).toHaveLength(count);
    });

    test('a fourth file is refused, and nothing of the upload is kept', async () => {
        const creativesBefore = (await listCreatives('brand')).length;
        const mediaBefore = (await as('brand', request(app).get('/api/assets'))).body.length;

        const upload = await multiFileUpload('Too long', Array(4).fill('frame-16x9.png'));

        expect(upload.status).toBe(400);
        expect(upload.body.error).toBe('A Creative holds at most 3 files');
        expect(await listCreatives('brand')).toHaveLength(creativesBefore);
        expect((await as('brand', request(app).get('/api/assets'))).body).toHaveLength(mediaBefore);
    });

    test('one bad file refuses the whole Creative, naming which file', async () => {
        const creativesBefore = (await listCreatives('brand')).length;

        const upload = await multiFileUpload('Half good', ['frame-16x9.png', 'frame-4x3.png']);

        expect(upload.status).toBe(400);
        expect(upload.body.error).toMatch(/^File 2: Media must be 16:9/);
        expect(await listCreatives('brand')).toHaveLength(creativesBefore);
    });

    test('only a Brand’s paid upload may hold several files', async () => {
        const upload = await as('admin', request(app).post('/api/assets/upload'))
            .field('title', 'House ad')
            .field('category', 'internal')
            .field('owner_type', 'platform')
            .field('approval_status', 'approved')
            .attach('file', VALID_PNG, { filename: 'one.png', contentType: 'image/png' })
            .attach('file', VALID_PNG, { filename: 'two.png', contentType: 'image/png' });

        expect(upload.status).toBe(400);
        expect(upload.body.error).toBe('Only a Brand’s Creative may hold several files');
    });

    test('a Brand upload that cannot be saved leaves no Creative behind', async () => {
        const { mediaRepository } = await import('../src/repositories/index.js');
        const before = (await listCreatives('brand')).length;
        const failing = jest.spyOn(mediaRepository, 'create').mockRejectedValueOnce(new Error('Firestore unavailable'));
        try {
            const upload = await as('brand', request(app).post('/api/assets/upload'))
                .field('title', 'Never saved')
                .field('category', 'paid')
                .attach('file', VALID_PNG, { filename: 'creative.png', contentType: 'image/png' });
            expect(upload.status).toBe(500);
        } finally {
            failing.mockRestore();
        }

        expect(await listCreatives('brand')).toHaveLength(before);
    });

    test('a multi-file upload whose second file cannot be saved keeps neither file nor Creative', async () => {
        const { mediaRepository } = await import('../src/repositories/index.js');
        const creativesBefore = (await listCreatives('brand')).length;
        const mediaBefore = (await as('brand', request(app).get('/api/assets'))).body.length;
        const save = mediaRepository.create.bind(mediaRepository);
        const failing = jest.spyOn(mediaRepository, 'create')
            .mockImplementationOnce(save)
            .mockRejectedValueOnce(new Error('Firestore unavailable'));
        try {
            const upload = await multiFileUpload('Half saved', ['frame-16x9.png', 'frame-16x9.jpg']);
            expect(upload.status).toBe(500);
        } finally {
            failing.mockRestore();
        }

        expect(await listCreatives('brand')).toHaveLength(creativesBefore);
        expect((await as('brand', request(app).get('/api/assets'))).body).toHaveLength(mediaBefore);
    });

    test('a storage failure answers 500 instead of stopping the server', async () => {
        const { creativeRepository } = await import('../src/repositories/index.js');
        const { headers } = await signInAs('superadmin', { permissions: ['creatives.approve'] });
        const unavailable = new Error('Firestore unavailable');
        const lists = jest.spyOn(creativeRepository, 'findForBrand').mockRejectedValueOnce(unavailable);
        const decides = jest.spyOn(creativeRepository, 'decide').mockRejectedValueOnce(unavailable);
        try {
            const list = await as('brand', request(app).get('/api/creatives'));
            expect(list.status).toBe(500);
            const approval = await request(app).post('/api/creatives/crv_any/approve').set(headers);
            expect(approval.status).toBe(500);
        } finally {
            lists.mockRestore();
            decides.mockRestore();
        }
    });
});
