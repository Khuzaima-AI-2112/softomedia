import { jest } from '@jest/globals';

jest.setTimeout(30_000);

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST
);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

describeWithEmulators('classified media API with Firebase emulators', () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from('emulator media bytes')]);
    let request;
    let app;
    let firestore;
    let bucket;
    let adminToken;
    let retailerToken;
    const createdIds = [];
    const createdObjects = [];

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
        process.env.DEMO_ASSETS_BUCKET = process.env.DEMO_ASSETS_BUCKET
            || `${process.env.GOOGLE_CLOUD_PROJECT}.firebasestorage.app`;
        ({ default: request } = await import('supertest'));
        ({ default: app } = await import('../index.js'));
        const { Firestore } = await import('@google-cloud/firestore');
        const { Storage } = await import('@google-cloud/storage');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        bucket = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT })
            .bucket(process.env.DEMO_ASSETS_BUCKET);
        const { provisionDemoPersonas } = await import('../src/services/DemoPersonaProvisioner.js');
        await provisionDemoPersonas({
            password: 'Phase1-demo-password!',
            expectedProjectId: process.env.GOOGLE_CLOUD_PROJECT,
        });
        [adminToken, retailerToken] = await Promise.all([
            signIn('admin@demo.softomedia.test', 'Phase1-demo-password!'),
            signIn('retaileradmin@demo.softomedia.test', 'Phase1-demo-password!'),
        ]);
    });

    afterAll(async () => {
        await Promise.all(createdIds.map(id => firestore.collection('media').doc(id).delete()));
        await Promise.all(createdObjects.map(name => bucket.file(name).delete({ ignoreNotFound: true })));
        await firestore.terminate();
    });

    it('persists an uploaded object and metadata that remain retrievable through HTTP', async () => {
        const upload = await request(app)
            .post('/api/assets/upload')
            .set('Authorization', `Bearer ${adminToken}`)
            .field('title', 'Emulator fallback media')
            .field('category', 'fallback')
            .field('owner_type', 'platform')
            .field('approval_status', 'approved')
            .field('duration', '5')
            .attach('file', pngBytes, {
                filename: 'fallback.png', contentType: 'image/png',
            });

        expect(upload.status).toBe(201);
        createdIds.push(upload.body.id);
        createdObjects.push(upload.body.storage_path.split('/').slice(3).join('/'));

        const persisted = await firestore.collection('media').doc(upload.body.id).get();
        expect(persisted.exists).toBe(true);
        expect(persisted.data()).toMatchObject({
            category: 'fallback',
            content_kind: 'neutral_fallback',
            storage_path: upload.body.storage_path,
        });

        const reloaded = await request(app)
            .get('/api/assets')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(reloaded.status).toBe(200);
        expect(reloaded.body).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: upload.body.id,
                category: 'fallback',
                content_kind: 'neutral_fallback',
                eligible_for_playback: true,
            }),
        ]));

        const [bytes] = await bucket.file(createdObjects.at(-1)).download();
        expect(bytes).toEqual(pngBytes);
    });

    it('denies a non-media persona before writing either persistence system', async () => {
        const before = await bucket.getFiles({ prefix: 'phase-1-demo/uploads/' });
        const response = await request(app)
            .post('/api/assets/upload')
            .set('Authorization', `Bearer ${retailerToken}`)
            .field('title', 'Forbidden system media')
            .field('category', 'fallback')
            .field('owner_type', 'platform')
            .field('approval_status', 'approved')
            .attach('file', pngBytes, { filename: 'forbidden.png', contentType: 'image/png' });

        expect(response.status).toBe(403);
        const after = await bucket.getFiles({ prefix: 'phase-1-demo/uploads/' });
        expect(after[0].length).toBe(before[0].length);
    });

    it('removes the Storage object when Firestore rejects oversized metadata', async () => {
        const [before] = await bucket.getFiles({ prefix: 'phase-1-demo/uploads/' });
        const response = await request(app)
            .post('/api/assets/upload')
            .set('Authorization', `Bearer ${adminToken}`)
            .field('title', 'x'.repeat(1_100_000))
            .field('category', 'internal')
            .field('owner_type', 'platform')
            .field('approval_status', 'approved')
            .attach('file', pngBytes, {
                filename: 'cleanup.png', contentType: 'image/png',
            });

        expect(response.status).toBe(500);
        expect(response.body.error).toMatch(/no success was recorded/i);
        const [after] = await bucket.getFiles({ prefix: 'phase-1-demo/uploads/' });
        expect(after.length).toBe(before.length);
    });

    it('does not expose a metadata alteration surface to unauthorized roles', async () => {
        const [existing] = createdIds;
        const before = await firestore.collection('media').doc(existing).get();
        const response = await request(app)
            .patch(`/api/assets/${existing}`)
            .set('Authorization', `Bearer ${retailerToken}`)
            .send({ approval_status: 'rejected' });

        expect([403, 404]).toContain(response.status);
        const after = await firestore.collection('media').doc(existing).get();
        expect(after.data()).toEqual(before.data());
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
