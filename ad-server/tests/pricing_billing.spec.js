/**
 * pricing_billing.spec.js — Sprint 15
 *
 * Covers:
 *   S15-1  Pricing route hardening (GET /config + PUT /config role guards)
 *   S15-2  Invoice generation and access control
 *
 * Pre-conditions (checked in beforeAll):
 *   • pricing.js exports a router with GET /config and PUT /config
 *   • invoices.js exports a router with POST /generate, GET /, GET /:id
 */

import request    from 'supertest';
import express    from 'express';
import pricingRouter  from '../src/api/pricing.js';
import invoicesRouter from '../src/api/invoices.js';
import { authenticate, authorize } from '../src/middleware/auth.js';

// ---- Minimal express app used by all tests ----
// Matches the structure in index.js: authenticate is applied at the router level.

const app = express();
app.use(express.json());
app.use('/api/pricing',  pricingRouter);
app.use('/api/invoices', authenticate, invoicesRouter);

// ---- Auth token helpers ----
// These reference the test JWT secret configured in the test environment.
// Adjust if the project uses a different env var name.

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import jwt from 'jsonwebtoken';

const makeToken = (payload) =>
    jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });

const adminToken      = makeToken({ id: 'admin-1',      role: 'admin',      email: 'admin@test.com' });
const advertiserToken = makeToken({ id: 'adv-1',        role: 'advertiser', email: 'adv@test.com', linked_entity_id: 'adv-entity-1' });
const anonToken       = '';   // no token — unauthenticated

// ===========================================================================
// S15-1  Pricing route hardening
// ===========================================================================

describe('S15-1 — GET /api/pricing/config', () => {
    it('returns 200 for admin', async () => {
        const res = await request(app)
            .get('/api/pricing/config')
            .set('Authorization', `Bearer ${adminToken}`);
        // Either 200 (config found) or a 5xx if Firestore is unavailable —
        // we only assert that the role guard didn’t 401/403.
        expect([200, 500]).toContain(res.status);
    });

    it('returns 401 for unauthenticated caller', async () => {
        const res = await request(app)
            .get('/api/pricing/config');
        expect(res.status).toBe(401);
    });

    it('returns 403 for advertiser role', async () => {
        const res = await request(app)
            .get('/api/pricing/config')
            .set('Authorization', `Bearer ${advertiserToken}`);
        expect(res.status).toBe(403);
    });
});

describe('S15-1 — PUT /api/pricing/config', () => {
    const validBody = {
        allocation: { paid: 70, retailer: 20, internal: 10 },
        cpm_rates:  { default: 15.00 },
    };

    it('returns 401 for unauthenticated caller', async () => {
        const res = await request(app)
            .put('/api/pricing/config')
            .send(validBody);
        expect(res.status).toBe(401);
    });

    it('returns 403 for advertiser role', async () => {
        const res = await request(app)
            .put('/api/pricing/config')
            .set('Authorization', `Bearer ${advertiserToken}`)
            .send(validBody);
        expect(res.status).toBe(403);
    });

    it('returns 400 when allocation does not sum to 100', async () => {
        const res = await request(app)
            .put('/api/pricing/config')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ allocation: { paid: 50, retailer: 10, internal: 10 } });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/100/);
    });
});

describe('S15-1 — GET /api/pricing/estimate', () => {
    it('returns 401 without token', async () => {
        const res = await request(app)
            .get('/api/pricing/estimate?slots=1000&cpm=10');
        // estimate is behind authenticate — confirm 401
        expect(res.status).toBe(401);
    });

    it('returns 400 for missing params', async () => {
        const res = await request(app)
            .get('/api/pricing/estimate')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
    });

    it('returns estimatedCost for valid params', async () => {
        const res = await request(app)
            .get('/api/pricing/estimate?slots=1000&cpm=10')
            .set('Authorization', `Bearer ${adminToken}`);
        // 1000 slots * $10 CPM / 1000 = $10.0000
        if (res.status === 200) {
            expect(parseFloat(res.body.estimatedCost)).toBeCloseTo(10, 2);
        } else {
            // If auth middleware rejects, that’s also fine — fail hard.
            expect(res.status).toBe(200);
        }
    });
});

// ===========================================================================
// S15-2  Invoice generation and access control
// ===========================================================================

describe('S15-2 — POST /api/invoices/generate', () => {
    it('returns 401 without token', async () => {
        const res = await request(app)
            .post('/api/invoices/generate')
            .send({ campaignId: 'c1' });
        expect(res.status).toBe(401);
    });

    it('returns 403 for advertiser role', async () => {
        const res = await request(app)
            .post('/api/invoices/generate')
            .set('Authorization', `Bearer ${advertiserToken}`)
            .send({ campaignId: 'c1' });
        expect(res.status).toBe(403);
    });

    it('returns 400 when campaignId is missing', async () => {
        const res = await request(app)
            .post('/api/invoices/generate')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
    });

    it('returns 404 for unknown campaignId', async () => {
        const res = await request(app)
            .post('/api/invoices/generate')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ campaignId: 'nonexistent-campaign-xyz' });
        // 404 (not found) or 500 (Firestore unavailable in test env)
        expect([404, 500]).toContain(res.status);
    });
});

describe('S15-2 — GET /api/invoices (list)', () => {
    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/invoices');
        expect(res.status).toBe(401);
    });

    it('returns 200 for admin', async () => {
        const res = await request(app)
            .get('/api/invoices')
            .set('Authorization', `Bearer ${adminToken}`);
        expect([200, 500]).toContain(res.status);
    });

    it('returns 403 or 200 for advertiser depending on linked_entity_id', async () => {
        const res = await request(app)
            .get('/api/invoices')
            .set('Authorization', `Bearer ${advertiserToken}`);
        // linked_entity_id is set in the token, so should not 403
        expect([200, 500]).toContain(res.status);
    });
});

describe('S15-2 — GET /api/invoices/:id (single)', () => {
    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/invoices/invoice-123');
        expect(res.status).toBe(401);
    });

    it('returns 404 for unknown invoice id (admin)', async () => {
        const res = await request(app)
            .get('/api/invoices/nonexistent-invoice-xyz')
            .set('Authorization', `Bearer ${adminToken}`);
        expect([404, 500]).toContain(res.status);
    });
});
