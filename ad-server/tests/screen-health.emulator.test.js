import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './fixtures/test-app.js';
import { getFirestore } from '../src/utils/firestore.js';
import apiRouter from '../src/api/index.js';

jest.setTimeout(30_000);

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = emulatorAvailable ? describe : describe.skip;
const ids = {
    retailer: 'issue-5-retailer',
    store: 'issue-5-store',
    location: 'issue-5-location',
    screen: 'issue-5-screen',
};

function asTechnicalOperator(app, method, path) {
    return request(app)[method](path)
        .set('Authorization', 'Bearer demo-token')
        .set('x-demo-role', 'techoperator');
}

describeWithEmulator('Technical Operator Screen health with Firebase emulators', () => {
    const firestore = getFirestore();
    const app = createTestApp(apiRouter, '/api');

    beforeAll(async () => {
        await firestore.collection('retailers').doc(ids.retailer).set({ id: ids.retailer, name: 'Issue 5 Retailer' });
        await firestore.collection('stores').doc(ids.store).set({
            id: ids.store,
            name: 'Issue 5 Store',
            retailer_id: ids.retailer,
            time_zone: 'America/Toronto',
        });
        await firestore.collection('locations').doc(ids.location).set({
            id: ids.location,
            name: 'Entrance',
            store_id: ids.store,
            retailer_id: ids.retailer,
        });
    });

    afterAll(async () => {
        await Promise.all([
            firestore.collection('loops').doc('issue-5-loop').delete(),
            firestore.collection('screens').doc(ids.screen).delete(),
            firestore.collection('locations').doc(ids.location).delete(),
            firestore.collection('stores').doc(ids.store).delete(),
            firestore.collection('retailers').doc(ids.retailer).delete(),
        ]);
    });

    test('persists registration, assignment, heartbeat, and independent schedule state', async () => {
        const created = await asTechnicalOperator(app, 'post', '/api/screens').send({
            screen_id: ids.screen,
            retailer_id: ids.retailer,
            store_id: ids.store,
            location_id: ids.location,
            resolution: '1920x1080',
        });
        expect(created.status).toBe(201);

        const heartbeat = await asTechnicalOperator(app, 'post', '/api/monitoring/heartbeat')
            .send({ screenId: ids.screen });
        expect(heartbeat.status).toBe(200);

        const persisted = await firestore.collection('screens').doc(ids.screen).get();
        expect(persisted.data()).toMatchObject({
            store_id: ids.store,
            location_id: ids.location,
            status: 'ONLINE',
        });
        expect(persisted.data().last_seen).toBeTruthy();

        const status = await asTechnicalOperator(app, 'get', '/api/monitoring/status');
        expect(status.status).toBe(200);
        expect(status.body.screens).toContainEqual(expect.objectContaining({
            id: ids.screen,
            connectivity: 'online',
            schedule: { state: 'unavailable', approved: false },
        }));

        await firestore.collection('loops').doc('issue-5-loop').set({
            id: 'issue-5-loop',
            date: new Date().toISOString().slice(0, 10),
            location_id: ids.location,
            status: 'approved',
        });
        const scheduledStatus = await asTechnicalOperator(app, 'get', '/api/monitoring/status');
        expect(scheduledStatus.body.screens).toContainEqual(expect.objectContaining({
            id: ids.screen,
            connectivity: 'online',
            schedule: { state: 'available', approved: true },
        }));

    });
});
