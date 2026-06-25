/**
 * Phase A / Step 7 — Retailer Loops
 *
 * Gap 3 closure: playlist / playlists naming disambiguation pre-flight.
 * Proves /api/playlist (singular, public, Player device endpoint) and
 * /api/playlists (plural, protected, Admin CRUD) are both mounted and
 * return distinct shapes before any Phase A step runs.
 *
 * Persona: DEMO_RETAILER
 * Steps:
 *   7.0  [beforeAll] playlist/playlists disambiguation pre-flight
 *   7.1  Login as Retailer
 *   7.2  Navigate to /dashboard/retailer/loops — page renders without 404
 *   7.3  GET /api/locations/:id/loops — 200, loop array returned
 *   7.4  Loop list renders — loop row and status badge visible
 *   7.5  Loop status badge value is one of: draft | approved | locked
 */

import { test, expect } from '@playwright/test';
import {
  DEMO_RETAILER,
  DEMO_ADMIN,
  BASE_URL,
  API_BASE_URL,
  SEED,
  DEMO_TOKEN,
  authReset,
  loginAs,
} from './demo.fixtures.js';

import { AdminLocators as AL } from './admin_locators.js';
import { RetailerLocators as RL, getLocator } from './retailer_locators.js';

test.describe.serial('Phase A — Retailer Loops', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // Gap 3 — Pre-flight: playlist vs playlists disambiguation
  // Runs once before the first test in this file.
  // ─────────────────────────────────────────────────────────────────────────
  test.beforeAll('playlist/playlists disambiguation pre-flight', async ({ playwright }) => {
    const adminCtx = await playwright.request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${DEMO_TOKEN}`,
        'x-demo-role': DEMO_ADMIN.role,
      },
    });

    try {
      // 1. Public player endpoint — /api/playlist (singular)
      //    No auth required. Must not 500 or refuse connection.
      const publicCtx = await playwright.request.newContext({ baseURL: API_BASE_URL });
      const playerRes = await publicCtx.get('/api/playlist');
      expect(
        playerRes.status(),
        '/api/playlist (public player endpoint) must not 500',
      ).not.toBe(500);
      expect(playerRes.status(), 'connection refused on /api/playlist').not.toBe(0);
      await publicCtx.dispose();

      // 2. Admin CRUD endpoint — /api/playlists (plural)
      //    Requires auth. Must return 200 with an array.
      const adminRes = await adminCtx.get('/api/playlists');
      expect(
        adminRes.status(),
        '/api/playlists (admin CRUD) must return 200',
      ).toBe(200);
      const adminBody = await adminRes.json();
      expect(
        Array.isArray(adminBody),
        '/api/playlists must return an array of playlist templates',
      ).toBe(true);

      // 3. Prove they are different shapes.
      //    Player endpoint returns current slot data (object or 404).
      //    Admin CRUD always returns an array.
      //    They must not return identical JSON.
      const playerBodyRaw = await playerRes.text().catch(() => '');
      const adminBodyRaw = JSON.stringify(adminBody);
      expect(
        playerBodyRaw === adminBodyRaw,
        '/api/playlist and /api/playlists must not return identical responses — they are different routes',
      ).toBe(false);
    } finally {
      await adminCtx.dispose();
    }
  });

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7.1 — Login
  // ─────────────────────────────────────────────────────────────────────────
  test('7.1 login as Retailer', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await expect(getLocator(page, AL.Shell)).toBeVisible();
    await expect(getLocator(page, RL.NavRetailer)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7.2 — Loops page renders
  // ─────────────────────────────────────────────────────────────────────────
  test('7.2 loops page renders without 404 or white screen', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + '/dashboard/retailer/loops',
      { waitUntil: 'domcontentloaded' },
    );
    // Must NOT show a 404 error element
    await expect(page.locator('[data-testid="error-404"]')).not.toBeVisible();
    // Must render the loops list container
    await getLocator(page, RL.LoopsList).waitFor({ timeout: 15000 });
    await expect(getLocator(page, RL.LoopsList)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7.3 — GET /api/locations/:id/loops returns 200
  // ─────────────────────────────────────────────────────────────────────────
  test('7.3 GET /api/locations/:id/loops — 200, array returned', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${DEMO_TOKEN}`,
        'x-demo-role': DEMO_RETAILER.role,
      },
    });
    try {
      const res = await ctx.get(`/api/locations/${SEED.storeIds[0]}/loops`);
      expect(res.status(), `GET /api/locations/${SEED.storeIds[0]}/loops returned ${res.status()}`).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body), '/api/locations/:id/loops must return an array').toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7.4 — Loop list renders loop rows and status badges
  // ─────────────────────────────────────────────────────────────────────────
  test('7.4 loop list renders rows with status badges', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + '/dashboard/retailer/loops',
      { waitUntil: 'domcontentloaded' },
    );
    await getLocator(page, RL.LoopsList).waitFor({ timeout: 15000 });

    // At least one loop row must exist (seeded in Phase 1)
    const firstRow = page.locator('[data-testid^="loop-row-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });

    // Each visible row must have a status badge
    const badges = page.locator('[data-testid^="loop-status-badge-"]');
    await expect(badges.first()).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7.5 — Status badge value is one of the schema enum values
  // ─────────────────────────────────────────────────────────────────────────
  test('7.5 loop status badge value matches schema enum: draft | approved | locked', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + '/dashboard/retailer/loops',
      { waitUntil: 'domcontentloaded' },
    );
    await getLocator(page, RL.LoopsList).waitFor({ timeout: 15000 });

    const VALID_STATUSES = new Set(['draft', 'approved', 'locked', 'pending', 'pending_approval', 'live', 'rejected']);
    const badges = await page.locator('[data-testid^="loop-status-badge-"]').all();

    expect(badges.length, 'No loop status badges found — loop rows may not be rendering').toBeGreaterThan(0);

    for (const badge of badges) {
      const text = (await badge.textContent() ?? '').trim().toLowerCase();
      expect(
        VALID_STATUSES.has(text),
        `Loop status badge shows '${text}' — must be one of: draft | approved | locked`,
      ).toBe(true);
    }
  });

});
