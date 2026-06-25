/**
 * Phase 6 — Admin Full-Circle Validation
 *
 * Steps:
 *   6.1  Login as Admin
 *   6.2  BonVie campaign visible in Admin Overview
 *   6.3  FreshMart screens show active in Network Map
 *
 * Note: Teardown of the demo campaign doc runs via globalTeardown in
 * 00_seed.setup.js after the full suite completes. Phase 6 no longer
 * deletes the campaign (moved in massivee2e.md Issue 6 fix — prevents
 * cascade failures in Phases 7–15 that depend on the campaign existing).
 *
 * Gap 2 closure (N-6.1):
 *   Unauthenticated GET /api/audit → must return 401.
 *   This is the canonical auth-gate smoke test for the API layer.
 *   (The same assertion also lives in 17_api_surface_smoke.spec.js N-K.1,
 *   but having it in Phase 6 catches regressions without requiring the
 *   full API smoke suite to run.)
 */

import { test, expect } from '@playwright/test';
import {
  DEMO_ADMIN,
  BASE_URL,
  API_BASE_URL,
  authReset,
  loginAs,
} from './demo.fixtures.js';

import { AdminLocators as AL, getLocator } from './admin_locators.js';

test.describe.serial('Phase 6 — Admin Full-Circle Validation', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  test('6.1 login as Admin', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await expect(getLocator(page, AL.Shell)).toBeVisible();
    await expect(getLocator(page, AL.NavAdmin)).toBeVisible();
  });

  test('6.2 BonVie campaign visible in Admin Overview', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin', { waitUntil: 'domcontentloaded' });
    await getLocator(page, AL.AdminOverview).waitFor({ timeout: 15000 });

    // Campaign created in Phase 3 must appear in the admin campaign list
    await expect(
      getLocator(page, AL.AdminOverview).getByText('BonVie').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('6.3 FreshMart screens show active in Network Map', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/map', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="network-map"]', { timeout: 20000 });

    // At least one FreshMart screen must be present and show active status
    await expect(
      page.locator('[data-testid="network-map"] [data-testid^="screen-pin-"]').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // N-6.1 — Gap 2: unauthenticated GET /api/audit → 401
  // ─────────────────────────────────────────────────────────────────────────
  test('N-6.1 unauthenticated GET /api/audit → 401 (auth gate confirmed)', async ({ playwright }) => {
    const anonCtx = await playwright.request.newContext({ baseURL: API_BASE_URL });
    try {
      const res = await anonCtx.get('/api/audit');
      expect(
        res.status(),
        'GET /api/audit with no auth must return 401 — auth middleware not applied',
      ).toBe(401);
    } finally {
      await anonCtx.dispose();
    }
  });

});
