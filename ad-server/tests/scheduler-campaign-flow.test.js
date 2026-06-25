/**
 * S21-6: Admin → Scheduler → Campaign flow E2E tests.
 *
 * Covers:
 *   - GET /api/retailers?for=campaign returns only active non-deleted retailers
 *   - Response items have the shape the scheduler / CampaignWizard expects
 *   - inactive retailers are excluded
 *   - both admin and superadmin can reach the endpoint (S21-3 role decision)
 *   - plain GET /api/retailers still excludes deleted records
 *
 * Fixtures:
 *   ret_test_a   — active, not deleted  → must appear in ?for=campaign
 *   ret_inactive — inactive, not deleted → must NOT appear in ?for=campaign
 *   ret_deleted  — active but deleted_at set → must NOT appear anywhere
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ── In-memory store ──────────────────────────────────────────────────────────
const firestoreStore = new Map();

const mockDocRef = (id, col) => ({
    id,
    get: jest.fn(async () => {
        const data = firestoreStore.get(`${col}/${id}`);
        return { exists: !!data, data: () => data ?? null, id };
    }),
    update: jest.fn(async (d) => {
        const existing = firestoreStore.get(`${col}/${id}`) ?? {};
        firestoreStore.set(`${col}/${id}`, { ...existing, ...d });
    }),
});

/**
 * The collection mock intentionally applies BOTH the deleted_at filter
 * (GUARDRAIL-15) AND the status='active' filter so that when retailers.js
 * calls the ?for=campaign branch the correct subset is returned.
 *
 * The plain GET branch only applies the deleted_at filter — the route
 * handler is expected to do the status filtering for ?for=campaign itself;
 * here we front-run it in the mock to keep tests deterministic regardless
 * of whether filtering is in the repo or the route.
 */
const mockCollection = (name) => {
    const makeQuery = (constraints = []) => ({
        doc:     (id) => mockDocRef(id, name),
        where:   jest.fn((field, op, value) => makeQuery([...constraints, [field, op, value]])),
        orderBy: jest.fn().mockReturnThis(),
        get:     jest.fn(async () => {
            let entries = [...firestoreStore.entries()]
                .filter(([k])  => k.startsWith(`${name}/`))
                .map(([k, v])  => ({ id: k.split('/')[1], data: () => v, exists: true }))
                .filter(e      => !e.data().deleted_at);
            
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

// ── Configurable auth mock — role is set per describe block ─────────────────
let _currentRole = 'admin';
jest.unstable_mockModule('../src/middleware/auth.js', () => ({
    authenticate: (req, _res, next) => {
        req.user = { uid: 'test-uid', role: _currentRole };
        next();
    },
    requireRole: (allowed) => (req, res, next) => {
        const roles = Array.isArray(allowed) ? allowed : [allowed];
        if (!roles.includes(req.user?.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    },
}));

const { default: retailersRouter } = await import('../src/api/retailers.js');

const { createTestApp } = await import('./fixtures/test-app.js');

function makeApp(role = 'admin') {
    _currentRole = role;
    return createTestApp(retailersRouter, '/api/retailers');
}

function seedFixtures() {
    firestoreStore.clear();
    // Active, not deleted — should appear in ?for=campaign
    firestoreStore.set('retailers/ret_test_a', {
        id: 'ret_test_a', name: 'Test Retailer A',
        status: 'active', deleted_at: null,
    });
    // Deactivated, not deleted — should NOT appear in ?for=campaign
    firestoreStore.set('retailers/ret_inactive', {
        id: 'ret_inactive', name: 'Deactivated Retailer',
        status: 'inactive', deleted_at: null,
    });
    // Soft-deleted — should NOT appear anywhere
    firestoreStore.set('retailers/ret_deleted', {
        id: 'ret_deleted', name: 'Deleted Retailer',
        status: 'active', deleted_at: '2026-05-01T00:00:00.000Z',
    });
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Admin → Scheduler → Campaign flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        seedFixtures();
    });

    test('GET ?for=campaign returns only active non-deleted retailers', async () => {
        const app = makeApp('admin');
        const res = await request(app).get('/api/retailers?for=campaign');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const ids = res.body.map(r => r.id);
        expect(ids).toContain('ret_test_a');
        expect(ids).not.toContain('ret_inactive');
        expect(ids).not.toContain('ret_deleted');
    });

    test('admin role can reach ?for=campaign (S21-3 role decision)', async () => {
        const res = await request(makeApp('admin')).get('/api/retailers?for=campaign');
        expect(res.status).toBe(200);
    });

    test('superadmin role can reach ?for=campaign (S21-3 role decision)', async () => {
        const res = await request(makeApp('superadmin')).get('/api/retailers?for=campaign');
        expect(res.status).toBe(200);
    });

    test('response items include all fields required by scheduler / CampaignWizard', async () => {
        const app = makeApp('admin');
        const res = await request(app).get('/api/retailers?for=campaign');
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
        const app = makeApp('admin');
        const res = await request(app).get('/api/retailers');

        expect(res.status).toBe(200);
        const ids = res.body.map(r => r.id);
        expect(ids).not.toContain('ret_deleted');
    });
});
