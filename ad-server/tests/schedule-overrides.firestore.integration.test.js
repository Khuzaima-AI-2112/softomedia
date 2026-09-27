import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

/**
 * #16: an override reported as saved is in Firestore, not only in this
 * process's memory, so a reload served by any instance still lists it.
 */
describeWithEmulators('Retailer schedule overrides in Firestore (#16)', () => {
    const suffix = Date.now();
    const retailerId = `override-retailer-${suffix}`;
    const storeId = `override-store-${suffix}`;
    let request;
    let app;
    let firestore;
    let retailerAdmin;

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        ({ default: app } = await import('../index.js'));
        await firestore.collection('stores').doc(storeId).set({
            id: storeId, name: 'Northwind Downtown', retailer_id: retailerId, status: 'active', time_zone: 'America/Toronto',
        });
        const { signInAs } = await import('./fixtures/emulator-sign-in.js');
        ({ headers: retailerAdmin } = await signInAs('retaileradmin', { organizationId: retailerId }));
    });

    afterAll(async () => {
        const saved = await firestore.collection('schedule_overrides').where('store_id', '==', storeId).get();
        await Promise.all([...saved.docs.map(doc => doc.ref.delete()), firestore.collection('stores').doc(storeId).delete()]);
    });

    test('a saved override is read back from Firestore after a reload', async () => {
        const override = { store_id: storeId, day: 'sunday', start: '09:00', end: '11:00', type: 'blocked' };

        const saved = await request(app).post('/api/schedules').set(retailerAdmin).send(override);
        expect(saved.status).toBe(201);

        const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
        clearMockStorage();

        const reloaded = await request(app).get('/api/schedules').query({ store_id: storeId }).set(retailerAdmin);
        expect(reloaded.status).toBe(200);
        expect(reloaded.body).toEqual([expect.objectContaining({ id: saved.body.id, ...override, retailer_id: retailerId })]);
    });
});
