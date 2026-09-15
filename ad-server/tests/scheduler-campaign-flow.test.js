/**
 * S21-6: Admin → Scheduler → Campaign flow.
 *
 * Covers:
 *   - GET /api/retailers?for=campaign returns only active non-deleted retailers
 *   - Response items have the shape the scheduler / CampaignWizard expects
 *   - inactive retailers are excluded
 *   - both admin and superadmin can reach the endpoint (S21-3 role decision)
 *   - plain GET /api/retailers still excludes deleted records
 *
 * Runs against the Firestore and Auth emulators with real Admin and Super
 * Administrator sign-ins.
 */

import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './fixtures/test-app.js';
import { signInAs } from './fixtures/emulator-sign-in.js';

jest.setTimeout(30_000);

const emulatorsAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = emulatorsAvailable ? describe : describe.skip;

const suffix = Date.now();
const ids = {
    active: `scheduler-active-${suffix}`,
    inactive: `scheduler-inactive-${suffix}`,
    deleted: `scheduler-deleted-${suffix}`,
};

describeWithEmulators('Admin → Scheduler → Campaign flow with Firebase emulators', () => {
    let app;
    let firestore;
    let admin;
    let superAdmin;

    beforeAll(async () => {
        const { getFirestore } = await import('../src/utils/firestore.js');
        const { default: apiRouter } = await import('../src/api/index.js');
        firestore = getFirestore();
        app = createTestApp(apiRouter, '/api');

        const retailers = firestore.collection('retailers');
        await Promise.all([
            // Active, not deleted — should appear in ?for=campaign
            retailers.doc(ids.active).set({ id: ids.active, name: 'Test Retailer A', status: 'active', deleted_at: null }),
            // Deactivated, not deleted — should NOT appear in ?for=campaign
            retailers.doc(ids.inactive).set({ id: ids.inactive, name: 'Deactivated Retailer', status: 'inactive', deleted_at: null }),
            // Soft-deleted — should NOT appear anywhere
            retailers.doc(ids.deleted).set({ id: ids.deleted, name: 'Deleted Retailer', status: 'active', deleted_at: '2026-05-01T00:00:00.000Z' }),
        ]);

        ({ headers: admin } = await signInAs('admin'));
        ({ headers: superAdmin } = await signInAs('superadmin'));
    });

    afterAll(async () => {
        await Promise.all(Object.values(ids).map(id => firestore.collection('retailers').doc(id).delete()));
    });

    test('GET ?for=campaign returns only active non-deleted retailers', async () => {
        const res = await request(app).get('/api/retailers?for=campaign').set(admin);

        expect(res.status).toBe(200);
        const returned = res.body.map(r => r.id);
        expect(returned).toContain(ids.active);
        expect(returned).not.toContain(ids.inactive);
        expect(returned).not.toContain(ids.deleted);
    });

    test.each([['admin'], ['superadmin']])('%s can reach ?for=campaign (S21-3 role decision)', async persona => {
        const res = await request(app).get('/api/retailers?for=campaign').set(persona === 'admin' ? admin : superAdmin);
        expect(res.status).toBe(200);
    });

    test('response items include all fields required by scheduler / CampaignWizard', async () => {
        const res = await request(app).get('/api/retailers?for=campaign').set(admin);
        expect(res.status).toBe(200);

        res.body.forEach(retailer => {
            // Minimum contract expected by ApiService.getRetailersForCampaign()
            expect(retailer).toHaveProperty('id');
            expect(retailer).toHaveProperty('name');
            expect(retailer).toHaveProperty('status', 'active');
            // GUARDRAIL-15: deleted_at must be absent or null on every returned record
            expect(retailer.deleted_at ?? null).toBeNull();
        });
    });

    test('plain GET /api/retailers also excludes soft-deleted records (GUARDRAIL-15)', async () => {
        const res = await request(app).get('/api/retailers').set(admin);

        expect(res.status).toBe(200);
        expect(res.body.map(r => r.id)).not.toContain(ids.deleted);
    });
});
