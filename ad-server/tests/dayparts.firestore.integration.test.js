import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

const EARLY_BREAKFAST = {
    breakfast: { start: 5, end: 10 },
    lunch: { start: 11, end: 15 },
    dinner: { start: 17, end: 21 },
};

/** #40: Dayparts reported as saved are in Firestore together with their audit record. */
describeWithEmulators('network Dayparts in Firestore (#40)', () => {
    let request;
    let app;
    let firestore;
    let superadmin;
    let saved;

    const daypartsDocument = () => firestore.collection('platform_config').doc('dayparts');

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        ({ default: app } = await import('../index.js'));
        const { signInAs } = await import('./fixtures/emulator-sign-in.js');
        ({ headers: superadmin } = await signInAs('superadmin'));
        saved = await daypartsDocument().get();
    });

    afterAll(async () => {
        const audits = await firestore.collection('platform_audits').where('action', '==', 'dayparts_updated').get();
        await Promise.all(audits.docs.map(doc => doc.ref.delete()));
        if (saved.exists) await daypartsDocument().set(saved.data());
        else await daypartsDocument().delete();
    });

    test('a Super Administrator\'s change is persisted with its audit record', async () => {
        const response = await request(app).put('/api/dayparts').set(superadmin).send(EARLY_BREAKFAST);

        expect(response.status).toBe(200);
        expect((await daypartsDocument().get()).data()).toMatchObject(EARLY_BREAKFAST);
        const audits = await firestore.collection('platform_audits').where('action', '==', 'dayparts_updated').get();
        expect(audits.docs.map(doc => doc.data())).toEqual([
            expect.objectContaining({ actor_role: 'superadmin', changes: EARLY_BREAKFAST }),
        ]);
    });
});
