import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

jest.setTimeout(30_000);

/**
 * #20: media uploaded before the fix is stored with its filename garbled.
 * Every reader of the media collection (the API, loop generation, the Player)
 * gets the name as it was uploaded.
 */
describeWithEmulator('media filenames stored before #20 was fixed', () => {
    const ORIGINAL = '—Pngtree—up to 20 off price_8775259.png';
    const id = `ast_garbled_${Date.now()}`;
    let firestore;
    let mediaRepository;

    beforeAll(async () => {
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        await firestore.collection('media').doc(id).set({
            id,
            filename: Buffer.from(ORIGINAL, 'utf8').toString('latin1'),
        });
        ({ mediaRepository } = await import('../src/repositories/MediaRepository.js'));
    });

    afterAll(() => firestore.collection('media').doc(id).delete());

    test('findById reads the name as uploaded', async () => {
        expect((await mediaRepository.findById(id)).filename).toBe(ORIGINAL);
    });

    test('findAll reads the name as uploaded', async () => {
        const media = await mediaRepository.findAll({ where: [['id', '==', id]] });
        expect(media.map(asset => asset.filename)).toEqual([ORIGINAL]);
    });

    test('findAllDurable reads the name as uploaded', async () => {
        const media = await mediaRepository.findAllDurable();
        expect(media.find(asset => asset.id === id).filename).toBe(ORIGINAL);
    });
});
