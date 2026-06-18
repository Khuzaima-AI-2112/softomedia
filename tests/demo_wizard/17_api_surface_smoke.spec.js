/**
 * Phase K / Step 17 — API Surface Smoke Test
 *
 * Gap 1 closure: 7 backend API routers with zero E2E coverage.
 * Gap 2 closure: unauthenticated access to protected route (step K.9).
 *
 * Type: Playwright request-fixture only — no browser / UI navigation.
 * Persona: DEMO_ADMIN headers on all protected calls.
 * Purpose: Prove each router is mounted, responds, and does not throw 500.
 *          Not a full CRUD test — existence + auth gate only.
 *
 * Routers covered:
 *   /api/ads          (public)    — serves ad creative to player
 *   /api/audit        (protected) — mutation audit log
 *   /api/impressions  (protected) — impression records
 *   /api/monitoring   (protected) — system health metrics
 *   /api/notifications(protected) — push/in-app notifications
 *   /api/ops          (protected) — internal admin ops
 *   /api/locations    (protected) — store/screen location data
 *   /api/playlists    (protected) — admin CRUD (≠ /api/playlist player endpoint)
 *   /api/dashboard    (protected) — admin overview
 *
 * NOTE: /api/playlist (singular) is the public Player endpoint exercised
 * indirectly by Phase 4. /api/playlists (plural) is the admin CRUD and
 * is distinct — proved by Gap 3 pre-flight in 07_retailer_loops.spec.js.
 */

import { test, expect } from '@playwright/test';
import { API_BASE_URL, DEMO_TOKEN, DEMO_ADMIN } from './demo.fixtures.js';

const ADMIN_HEADERS = {
  Authorization:  `Bearer ${DEMO_TOKEN}`,
  'x-demo-role':  DEMO_ADMIN.role,
};

test.describe.serial('Phase K — API Surface Smoke', () => {

  let request;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({
      baseURL:          API_BASE_URL,
      extraHTTPHeaders: ADMIN_HEADERS,
    });
  });

  test.afterAll(async () => {
    await request.dispose();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.1 — /api/ads  (public)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.1 GET /api/ads — router mounted, no 500', async () => {
    const res = await request.get('/api/ads', { headers: {} }); // no auth — public
    expect(res.status(), `GET /api/ads returned ${res.status()}`).not.toBe(500);
    expect(res.status(), 'connection refused on /api/ads').not.toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.2 — /api/audit  (protected)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.2 GET /api/audit — 200, array body, no 500', async () => {
    const res = await request.get('/api/audit');
    expect(res.status(), `GET /api/audit returned ${res.status()}`).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body), '/api/audit body must be an array').toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.3 — /api/impressions  (protected)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.3 GET /api/impressions — 200, array or paginated, no 500', async () => {
    const res = await request.get('/api/impressions');
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Accept either a plain array or a paginated { data: [], total: N } shape
    const isArray    = Array.isArray(body);
    const isPaginated = body !== null && typeof body === 'object' &&
                        ('data' in body || 'items' in body || 'results' in body);
    expect(
      isArray || isPaginated,
      '/api/impressions must return array or paginated object',
    ).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.4 — /api/monitoring  (protected)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.4 GET /api/monitoring — 200, contains at least one metric key', async () => {
    const res = await request.get('/api/monitoring');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body, '/api/monitoring body must be a non-null object').not.toBeNull();
    expect(typeof body).toBe('object');
    // Must have at least one key — a completely empty object means the handler is a stub
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.5 — /api/notifications  (protected)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.5 GET /api/notifications — 200, array body', async () => {
    const res = await request.get('/api/notifications');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body), '/api/notifications body must be an array').toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.6 — /api/ops  (protected)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.6 GET /api/ops — 200 or 204, no 500', async () => {
    const res = await request.get('/api/ops');
    expect([200, 204], `GET /api/ops returned unexpected ${res.status()}`)
      .toContain(res.status());
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.7 — /api/locations  (protected)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.7 GET /api/locations — 200, array, FreshMart locations visible', async () => {
    const res = await request.get('/api/locations');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body), '/api/locations must return an array').toBe(true);
    // At least the seeded FreshMart stores must be present
    const names = body.map((l) => l.name ?? l.retailerId ?? '');
    const hasFreshMart = names.some(
      (n) => typeof n === 'string' && n.toLowerCase().includes('freshmart'),
    ) || body.some((l) => (l.retailerId ?? '').includes('freshmart'));
    expect(hasFreshMart, 'FreshMart locations must appear in /api/locations').toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.8 — /api/playlists  (protected admin CRUD)
  // Confirms the PLURAL admin endpoint is distinct from /api/playlist (player)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.8 GET /api/playlists — 200, array (admin CRUD, distinct from player /api/playlist)', async () => {
    const res = await request.get('/api/playlists');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body), '/api/playlists must return an array of templates').toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // K.9 — /api/dashboard  (protected)
  // ─────────────────────────────────────────────────────────────────────────
  test('K.9 GET /api/dashboard — 200, non-null object', async () => {
    const res = await request.get('/api/dashboard');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
    expect(typeof body).toBe('object');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // N-K.1 — Gap 2: unauthenticated access to protected route → 401
  // ─────────────────────────────────────────────────────────────────────────
  test('N-K.1 GET /api/audit with no auth → 401 Unauthorized', async ({ playwright }) => {
    // Use a fresh context with NO headers
    const anonRequest = await playwright.request.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await anonRequest.get('/api/audit');
      expect(
        res.status(),
        'Unauthenticated request to /api/audit must be rejected with 401',
      ).toBe(401);
      const body = await res.json().catch(() => null);
      if (body !== null) {
        // Body should indicate unauthorized — accept any of the common shapes
        const hasErrorKey = 'error' in body || 'message' in body || 'status' in body;
        expect(hasErrorKey, '401 body must contain error/message/status key').toBe(true);
      }
    } finally {
      await anonRequest.dispose();
    }
  });

});
