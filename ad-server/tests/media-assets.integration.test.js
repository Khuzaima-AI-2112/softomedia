import { jest } from '@jest/globals';

jest.setTimeout(30_000);

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST
);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

describeWithEmulators('classified media API with Firebase emulators', () => {
    let request;
    let app;
    let firestore;
    let bucket;
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
    });

    afterAll(async () => {
        await Promise.all(createdIds.map(id => firestore.collection('media').doc(id).delete()));
        await Promise.all(createdObjects.map(name => bucket.file(name).delete({ ignoreNotFound: true })));
        await firestore.terminate();
    });

    it('persists an uploaded object and metadata that remain retrievable through HTTP', async () => {
        const upload = await request(app)
            .post('/api/assets/upload')
            .set('Authorization', 'Bearer demo-token')
            .set('x-demo-role', 'admin')
            .field('title', 'Emulator fallback media')
            .field('category', 'fallback')
            .field('owner_type', 'platform')
            .field('approval_status', 'approved')
            .field('duration', '5')
            .attach('file', Buffer.from('emulator media bytes'), {
                filename: 'fallback.png', contentType: 'image/png',
            });

        expect(upload.status).toBe(201);
        createdIds.push(upload.body.id);
        createdObjects.push(upload.body.storage_path.split('/').slice(3).join('/'));

        const reloaded = await request(app)
            .get('/api/assets')
            .set('Authorization', 'Bearer demo-token')
            .set('x-demo-role', 'admin');
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
        expect(bytes.toString()).toBe('emulator media bytes');
    });

    it('denies a non-media persona before writing either persistence system', async () => {
        const before = await bucket.getFiles({ prefix: 'phase-1-demo/uploads/' });
        const response = await request(app)
            .post('/api/assets/upload')
            .set('Authorization', 'Bearer demo-token')
            .set('x-demo-role', 'retaileradmin')
            .field('title', 'Forbidden system media')
            .field('category', 'fallback')
            .field('owner_type', 'platform')
            .field('approval_status', 'approved')
            .attach('file', Buffer.from('forbidden'), { filename: 'forbidden.png', contentType: 'image/png' });

        expect(response.status).toBe(403);
        const after = await bucket.getFiles({ prefix: 'phase-1-demo/uploads/' });
        expect(after[0].length).toBe(before[0].length);
    });
});
