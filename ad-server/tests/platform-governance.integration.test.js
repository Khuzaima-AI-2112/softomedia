import request from 'supertest';
import { createTestApp } from './fixtures/test-app.js';
import { getFirestore } from '../src/utils/firestore.js';
import { clearMockStorage } from '../src/repositories/BaseRepository.js';
import { platformAuditRepository } from '../src/repositories/index.js';
import apiRouter from '../src/api/index.js';
import { describeWithAuthEmulator, signInAs } from './fixtures/emulator-sign-in.js';

const identities = {};

// Every request from this app carries the signed-in role's Firebase ID token.
const appForRole = (role) => createTestApp(apiRouter, '/api', {
    middleware: [
        (req, _res, next) => {
            Object.assign(req.headers, { authorization: identities[role].headers.Authorization });
            next();
        },
    ],
});

describeWithAuthEmulator('platform governance HTTP API', () => {
    // These tests save global pricing; other suites read it from the same emulator.
    const pricingDocument = () => getFirestore().collection('pricing_config').doc('global');
    let savedPricing;

    beforeAll(async () => {
        savedPricing = await pricingDocument().get();
    });

    afterAll(async () => {
        if (savedPricing.exists) await pricingDocument().set(savedPricing.data());
        else await pricingDocument().delete();
    });

    beforeEach(async () => {
        clearMockStorage();
        for (const role of ['superadmin', 'admin']) identities[role] = await signInAs(role);
    });

    it('lets a Super Administrator create a persisted demo organization', async () => {
        const created = await request(appForRole('superadmin'))
            .post('/api/platform/organizations')
            .send({ name: 'Northern Lights Retail', type: 'retailer' });

        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({
            name: 'Northern Lights Retail',
            type: 'retailer',
            status: 'active',
            demo: true,
        });

        const listed = await request(appForRole('superadmin')).get('/api/platform/organizations');

        expect(listed.status).toBe(200);
        expect(listed.body).toEqual([expect.objectContaining({ id: created.body.id })]);
    });

    it('lets only a Super Administrator update and deactivate a demo organization', async () => {
        const superAdmin = appForRole('superadmin');
        const created = await request(superAdmin)
            .post('/api/platform/organizations')
            .send({ name: 'Northern Lights Retail', type: 'retailer' });

        const denied = await request(appForRole('admin'))
            .patch(`/api/platform/organizations/${created.body.id}`)
            .send({ status: 'inactive' });
        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'Forbidden',
            required: 'superadmin',
            actual: 'admin',
        });

        const updated = await request(superAdmin)
            .patch(`/api/platform/organizations/${created.body.id}`)
            .send({ name: 'Northern Lights Markets', status: 'inactive' });

        expect(updated.status).toBe(200);
        expect(updated.body).toMatchObject({
            name: 'Northern Lights Markets',
            status: 'inactive',
            demo: true,
        });
    });

    it('stores only canonical roles when a Super Administrator manages a user profile', async () => {
        const superAdmin = appForRole('superadmin');
        const created = await request(superAdmin)
            .post('/api/users')
            .send({ name: 'Avery Brand', email: 'avery@example.test', role: 'brand' });

        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({
            name: 'Avery Brand',
            email: 'avery@example.test',
            role: 'brand',
            status: 'active',
        });

        const deactivated = await request(superAdmin)
            .patch(`/api/users/${created.body.id}`)
            .send({ status: 'inactive' });

        expect(deactivated.status).toBe(200);
        expect(deactivated.body).toMatchObject({ id: created.body.id, status: 'inactive' });
    });

    it('persists a valid global allocation and audits the Super Administrator who accepted it', async () => {
        const superAdmin = appForRole('superadmin');
        const configured = await request(superAdmin)
            .put('/api/pricing/config')
            .send({ baseCPM: 18, allocation: { paid: 70, retailer: 20, internal: 10 } });

        expect(configured.status).toBe(200);
        expect(configured.body).toMatchObject({
            baseCPM: 18,
            allocation: { paid: 70, retailer: 20, internal: 10 },
        });

        const audit = await request(superAdmin).get('/api/platform/audit');

        expect(audit.status).toBe(200);
        expect(audit.body).toEqual(expect.arrayContaining([
            expect.objectContaining({
                action: 'pricing_config_updated',
                actor_id: identities.superadmin.uid,
                changes: { baseCPM: 18, allocation: { paid: 70, retailer: 20, internal: 10 } },
            }),
        ]));

        const denied = await request(appForRole('admin'))
            .put('/api/pricing/config')
            .send({ allocation: { paid: 70, retailer: 20, internal: 10 } });
        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({
            error: 'Forbidden',
            required: 'superadmin',
            actual: 'admin',
        });
    });

    it('returns a truthful validation error without changing the saved allocation', async () => {
        const superAdmin = appForRole('superadmin');
        const before = await request(superAdmin).get('/api/pricing/config');

        const rejected = await request(superAdmin)
            .put('/api/pricing/config')
            .send({ allocation: { paid: 80, retailer: 20, internal: 10 } });

        expect(rejected.status).toBe(400);
        expect(rejected.body).toEqual({ error: 'Allocation must sum to 100' });

        const after = await request(superAdmin).get('/api/pricing/config');
        expect(after.body.allocation).toEqual(before.body.allocation);
    });

    it('does not change saved pricing when recording the acceptance audit fails', async () => {
        const superAdmin = appForRole('superadmin');
        const before = await request(superAdmin).get('/api/pricing/config');
        // The audit write fails inside the save: its record id is already taken.
        const takenAuditId = `platform_audit_taken_${Date.now()}`;
        await platformAuditRepository.create(takenAuditId, { action: 'occupied' });
        const buildRecord = platformAuditRepository.buildRecord;
        platformAuditRepository.buildRecord = entry => ({
            ...buildRecord.call(platformAuditRepository, entry),
            id: takenAuditId,
        });
        try {
            const rejected = await request(superAdmin)
                .put('/api/pricing/config')
                .send({ baseCPM: 21, allocation: { paid: 70, retailer: 20, internal: 10 } });

            expect(rejected.status).toBe(500);
            expect(rejected.body).toEqual({ error: 'Failed to update pricing config' });
            const after = await request(superAdmin).get('/api/pricing/config');
            expect(after.body.allocation).toEqual(before.body.allocation);
            expect(after.body.baseCPM).toBe(before.body.baseCPM);
        } finally {
            platformAuditRepository.buildRecord = buildRecord;
        }
    });
});
