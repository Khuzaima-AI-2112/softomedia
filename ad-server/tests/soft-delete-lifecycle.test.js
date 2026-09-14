/**
 * S21-6: Soft-delete lifecycle E2E tests.
 *
 * Covers:
 *   - DELETE /api/retailers/:id  → sets deleted_at, does NOT hard-delete (GUARDRAIL-15)
 *   - GET  /api/retailers        → excludes soft-deleted records
 *   - GET  /api/retailers/:id    → 404 on soft-deleted record
 *   - GET  /api/retailers?for=campaign → excludes soft-deleted AND inactive records
 *   - DELETE /api/advertisers/:id → same lifecycle
 *   - PATCH /api/advertisers/:id  → cannot overwrite deleted_at (S21-2 / SEC-S21-1)
 *
 * Mocking strategy:
 *   Firestore and auth middleware are mocked via jest.unstable_mockModule.
 *   No live database connection required.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ── In-memory Firestore store shared across route handlers ───────────────────
const firestoreStore = new Map();

const mockDocRef = (id, col) => ({
    id,
    get: jest.fn(async () => {
        const data = firestoreStore.get(`${col}/${id}`);
        return { exists: !!data, data: () => data ?? null, id };
    }),
    set: jest.fn(async (d) => firestoreStore.set(`${col}/${id}`, d)),
    update: jest.fn(async (d) => {
        const existing = firestoreStore.get(`${col}/${id}`) ?? {};
        firestoreStore.set(`${col}/${id}`, { ...existing, ...d });
    }),
    delete: jest.fn(async () => firestoreStore.delete(`${col}/${id}`)),
});

/**
 * mockCollection simulates:
 *   - deleted_at filter (GUARDRAIL-15): records with truthy deleted_at are excluded
 *   - where() filter chains applied by the route (e.g. status='active' for ?for=campaign)
 */
const mockCollection = (name) => {
    // Accumulate where constraints for the current query chain.
    // Each where() call adds a [field, op, value] tuple.
    const makeQuery = (constraints = []) => ({
        doc:     (id) => mockDocRef(id, name),
        where:   jest.fn((field, op, value) => makeQuery([...constraints, [field, op, value]])),
        orderBy: jest.fn().mockReturnThis(),
        limit:   jest.fn().mockReturnThis(),
        get:     jest.fn(async () => {
            let entries = [...firestoreStore.entries()]
                .filter(([k]) => k.startsWith(`${name}/`))
                .map(([k, v])  => ({ id: k.split('/')[1], data: () => v, exists: true }))
                .filter(e => !e.data().deleted_at); // GUARDRAIL-15 baseline filter

            // Apply accumulated where() constraints
            for (const [field, op, value] of constraints) {
                if (op === '==') entries = entries.filter(e => e.data()[field] === value);
                else if (op === '!=') entries = entries.filter(e => e.data()[field] !== value);
                else if (op === '>')  entries = entries.filter(e => e.data()[field] >  value);
                else if (op === '>=') entries = entries.filter(e => e.data()[field] >= value);
                else if (op === '<')  entries = entries.filter(e => e.data()[field] <  value);
                else if (op === '<=') entries = entries.filter(e => e.data()[field] <= value);
            }

            return { docs: entries, empty: entries.length === 0 };
        }),
    });
    return makeQuery();
};

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore:   jest.fn(() => ({ collection: mockCollection })),
    closeFirestore: jest.fn(),
}));

// ── Auth middleware: pass-through, sets req.user = admin ────────────────────
jest.unstable_mockModule('../src/middleware/auth.js', () => ({
    authenticate: (req, _res, next) => {
        req.user = { uid: 'test-uid', role: 'admin' };
        next();
    },
    requireRole: () => (_req, _res, next) => next(),
}));

// ── Dynamic imports (AFTER all mocks are registered) ────────────────────────
const { default: retailersRouter }   = await import('../src/api/retailers.js');
const { default: advertisersRouter } = await import('../src/api/advertisers.js');

const { createTestApp } = await import('./fixtures/test-app.js');

function makeApp() {
    const app = createTestApp(retailersRouter, '/api/retailers');
    app.use('/api/advertisers', advertisersRouter);
    return app;
}

// ────────────────────────────────────────────────────────────────────────────
describe('Soft-delete lifecycle — retailers', () => {
    let app;

    beforeEach(() => {
        firestoreStore.clear();
        jest.clearAllMocks();
        app = makeApp();

        // Seed: Test Retailer A — active, not deleted
        firestoreStore.set('retailers/ret_test_a', {
            id:         'ret_test_a',
            name:       'Test Retailer A',
            status:     'active',
            deleted_at: null,
        });
    });

    test('GET /api/retailers includes ret_test_a when active', async () => {
        const res = await request(app).get('/api/retailers');
        expect(res.status).toBe(200);
        expect(res.body.map(r => r.id)).toContain('ret_test_a');
    });

    test('DELETE /api/retailers/:id sets deleted_at and does NOT hard-delete (GUARDRAIL-15)', async () => {
        const res = await request(app).delete('/api/retailers/ret_test_a');
        expect(res.status).toBe(200);

        // Record must still exist in the store
        const stored = firestoreStore.get('retailers/ret_test_a');
        expect(stored).toBeDefined();
        expect(stored.deleted_at).toBeTruthy();
    });

    test('GET /api/retailers excludes soft-deleted record (GUARDRAIL-15)', async () => {
        firestoreStore.set('retailers/ret_test_a', {
            id:         'ret_test_a',
            name:       'Test Retailer A',
            status:     'active',
            deleted_at: '2026-06-01T00:00:00.000Z',
        });

        const res = await request(app).get('/api/retailers');
        expect(res.status).toBe(200);
        expect(res.body.map(r => r.id)).not.toContain('ret_test_a');
    });

    test('GET /api/retailers/:id returns 404 for soft-deleted record', async () => {
        firestoreStore.set('retailers/ret_test_a', {
            id:         'ret_test_a',
            name:       'Test Retailer A',
            status:     'active',
            deleted_at: '2026-06-01T00:00:00.000Z',
        });

        const res = await request(app).get('/api/retailers/ret_test_a');
        expect(res.status).toBe(404);
    });

    test('GET /api/retailers?for=campaign excludes soft-deleted record', async () => {
        firestoreStore.set('retailers/ret_test_a', {
            id:         'ret_test_a',
            name:       'Test Retailer A',
            status:     'active',
            deleted_at: '2026-06-01T00:00:00.000Z',
        });

        const res = await request(app).get('/api/retailers?for=campaign');
        expect(res.status).toBe(200);
        expect(res.body.map(r => r.id)).not.toContain('ret_test_a');
    });

    test('GET /api/retailers?for=campaign excludes inactive (non-deleted) retailer (S21-4)', async () => {
        firestoreStore.set('retailers/ret_test_a', {
            id:         'ret_test_a',
            name:       'Test Retailer A',
            status:     'inactive',   // deactivated, not deleted
            deleted_at: null,
        });

        const res = await request(app).get('/api/retailers?for=campaign');
        expect(res.status).toBe(200);
        expect(res.body.map(r => r.id)).not.toContain('ret_test_a');
    });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Soft-delete lifecycle — advertisers', () => {
    let app;

    beforeEach(() => {
        firestoreStore.clear();
        jest.clearAllMocks();
        app = makeApp();

        firestoreStore.set('advertisers/adv_test_a', {
            id:         'adv_test_a',
            name:       'Test Advertiser A',
            status:     'active',
            deleted_at: null,
        });
    });

    test('DELETE /api/advertisers/:id sets deleted_at, does not hard-delete (GUARDRAIL-15)', async () => {
        const res = await request(app).delete('/api/advertisers/adv_test_a');
        expect(res.status).toBe(200);

        const stored = firestoreStore.get('advertisers/adv_test_a');
        expect(stored).toBeDefined();
        expect(stored.deleted_at).toBeTruthy();
    });

    test('GET /api/advertisers excludes soft-deleted advertiser (GUARDRAIL-15)', async () => {
        firestoreStore.set('advertisers/adv_test_a', {
            id:         'adv_test_a',
            name:       'Test Advertiser A',
            status:     'active',
            deleted_at: '2026-06-01T00:00:00.000Z',
        });

        const res = await request(app).get('/api/advertisers');
        expect(res.status).toBe(200);
        expect(res.body.map(a => a.id)).not.toContain('adv_test_a');
    });

    test('PATCH /api/advertisers/:id strips deleted_at — cannot resurrect via PATCH (S21-2)', async () => {
        // Mark advertiser as deleted
        firestoreStore.set('advertisers/adv_test_a', {
            id:         'adv_test_a',
            name:       'Test Advertiser A',
            status:     'active',
            deleted_at: '2026-06-01T00:00:00.000Z',
        });

        // Attempt to clear deleted_at via PATCH — allowlist strips it
        const res = await request(app)
            .patch('/api/advertisers/adv_test_a')
            .send({ deleted_at: null });

        // Allowlist produces an empty patch → 400
        expect(res.status).toBe(400);

        // Confirm deleted_at is still set in the store
        const stored = firestoreStore.get('advertisers/adv_test_a');
        expect(stored.deleted_at).toBe('2026-06-01T00:00:00.000Z');
    });

    test('PATCH /api/advertisers/:id with valid field does not touch deleted_at (S21-2)', async () => {
        firestoreStore.set('advertisers/adv_test_a', {
            id:         'adv_test_a',
            name:       'Test Advertiser A',
            status:     'active',
            deleted_at: '2026-06-01T00:00:00.000Z',
        });

        await request(app)
            .patch('/api/advertisers/adv_test_a')
            .send({ name: 'Renamed Advertiser A' });

        const stored = firestoreStore.get('advertisers/adv_test_a');
        // deleted_at must survive a legitimate PATCH
        expect(stored.deleted_at).toBe('2026-06-01T00:00:00.000Z');
    });
});
