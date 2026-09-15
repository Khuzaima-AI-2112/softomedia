/**
 * S21-6: Soft-delete lifecycle (GUARDRAIL-15: deleting a Retailer or Advertiser
 * is always a soft delete).
 *
 * Covers:
 *   - DELETE /api/retailers/:id  → sets deleted_at, does NOT hard-delete
 *   - GET  /api/retailers        → excludes soft-deleted records
 *   - GET  /api/retailers/:id    → 404 on soft-deleted record
 *   - GET  /api/retailers?for=campaign → excludes soft-deleted AND inactive records
 *   - DELETE /api/advertisers/:id → same lifecycle
 *   - PATCH /api/advertisers/:id  → cannot overwrite deleted_at (S21-2 / SEC-S21-1)
 *
 * Runs against the Firestore and Auth emulators with a real Super Administrator
 * sign-in, so the routes' own filtering is what is tested.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './fixtures/test-app.js';
import { signInAs } from './fixtures/emulator-sign-in.js';

jest.setTimeout(30_000);

const emulatorsAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = emulatorsAvailable ? describe : describe.skip;

const suffix = Date.now();
const retailerId = `soft-delete-retailer-${suffix}`;
const advertiserId = `soft-delete-advertiser-${suffix}`;
const DELETED_AT = '2026-06-01T00:00:00.000Z';

describeWithEmulators('Soft-delete lifecycle with Firebase emulators', () => {
    let app;
    let firestore;
    let superAdmin;

    const retailers = () => firestore.collection('retailers');
    const advertisers = () => firestore.collection('advertisers');
    const seedRetailer = fields => retailers().doc(retailerId).set({
        id: retailerId, name: 'Test Retailer A', status: 'active', deleted_at: null, ...fields,
    });
    const seedAdvertiser = fields => advertisers().doc(advertiserId).set({
        id: advertiserId, name: 'Test Advertiser A', status: 'active', deleted_at: null, ...fields,
    });

    beforeAll(async () => {
        const { getFirestore } = await import('../src/utils/firestore.js');
        const { default: apiRouter } = await import('../src/api/index.js');
        firestore = getFirestore();
        app = createTestApp(apiRouter, '/api');
        ({ headers: superAdmin } = await signInAs('superadmin'));
    });

    afterAll(async () => {
        await Promise.all([retailers().doc(retailerId).delete(), advertisers().doc(advertiserId).delete()]);
    });

    describe('retailers', () => {
        beforeEach(() => seedRetailer());

        test('GET /api/retailers includes an active Retailer', async () => {
            const res = await request(app).get('/api/retailers').set(superAdmin);
            expect(res.status).toBe(200);
            expect(res.body.map(r => r.id)).toContain(retailerId);
        });

        test('DELETE /api/retailers/:id sets deleted_at and does NOT hard-delete (GUARDRAIL-15)', async () => {
            const res = await request(app).delete(`/api/retailers/${retailerId}`).set(superAdmin);
            expect(res.status).toBe(200);

            const stored = await retailers().doc(retailerId).get();
            expect(stored.exists).toBe(true);
            expect(stored.data().deleted_at).toBeTruthy();
        });

        test('GET /api/retailers excludes a soft-deleted record (GUARDRAIL-15)', async () => {
            await seedRetailer({ deleted_at: DELETED_AT });
            const res = await request(app).get('/api/retailers').set(superAdmin);
            expect(res.status).toBe(200);
            expect(res.body.map(r => r.id)).not.toContain(retailerId);
        });

        test('GET /api/retailers/:id returns 404 for a soft-deleted record', async () => {
            await seedRetailer({ deleted_at: DELETED_AT });
            const res = await request(app).get(`/api/retailers/${retailerId}`).set(superAdmin);
            expect(res.status).toBe(404);
        });

        test('GET /api/retailers?for=campaign excludes a soft-deleted record', async () => {
            await seedRetailer({ deleted_at: DELETED_AT });
            const res = await request(app).get('/api/retailers?for=campaign').set(superAdmin);
            expect(res.status).toBe(200);
            expect(res.body.map(r => r.id)).not.toContain(retailerId);
        });

        test('GET /api/retailers?for=campaign excludes an inactive (non-deleted) Retailer (S21-4)', async () => {
            await seedRetailer({ status: 'inactive' });
            const res = await request(app).get('/api/retailers?for=campaign').set(superAdmin);
            expect(res.status).toBe(200);
            expect(res.body.map(r => r.id)).not.toContain(retailerId);
        });
    });

    describe('advertisers', () => {
        beforeEach(() => seedAdvertiser());

        test('DELETE /api/advertisers/:id sets deleted_at, does not hard-delete (GUARDRAIL-15)', async () => {
            const res = await request(app).delete(`/api/advertisers/${advertiserId}`).set(superAdmin);
            expect(res.status).toBe(200);

            const stored = await advertisers().doc(advertiserId).get();
            expect(stored.exists).toBe(true);
            expect(stored.data().deleted_at).toBeTruthy();
        });

        test('GET /api/advertisers excludes a soft-deleted Advertiser (GUARDRAIL-15)', async () => {
            await seedAdvertiser({ deleted_at: DELETED_AT });
            const res = await request(app).get('/api/advertisers').set(superAdmin);
            expect(res.status).toBe(200);
            expect(res.body.map(a => a.id)).not.toContain(advertiserId);
        });

        test('PATCH /api/advertisers/:id strips deleted_at — cannot resurrect via PATCH (S21-2)', async () => {
            await seedAdvertiser({ deleted_at: DELETED_AT });

            // The allowlist strips deleted_at, leaving an empty patch.
            const res = await request(app).patch(`/api/advertisers/${advertiserId}`).set(superAdmin)
                .send({ deleted_at: null });
            expect(res.status).toBe(400);

            const stored = await advertisers().doc(advertiserId).get();
            expect(stored.data().deleted_at).toBe(DELETED_AT);
        });

        test('PATCH /api/advertisers/:id with a valid field does not touch deleted_at (S21-2)', async () => {
            await seedAdvertiser({ deleted_at: DELETED_AT });

            await request(app).patch(`/api/advertisers/${advertiserId}`).set(superAdmin)
                .send({ name: 'Renamed Advertiser A' });

            const stored = await advertisers().doc(advertiserId).get();
            expect(stored.data().deleted_at).toBe(DELETED_AT);
        });
    });
});
