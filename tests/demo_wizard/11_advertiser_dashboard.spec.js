/**
 * Phase 11 — Advertiser Dashboard
 * Persona: DEMO_ADVERTISER | x-demo-role: advertiser
 *
 * Note: 'advertiser' role at /dashboard/advertiser/* is DISTINCT from
 * 'brand' role at /dashboard/brand/*. Both are separate route trees (Sprint 14).
 *
 * Gap 2 negative: Wrong-role route access → 403 or redirect, admin content not rendered.
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_ADVERTISER, BASE_URL } from './demo.fixtures.js';
import { BrandLocators as BL, getLocator } from './brand_locators.js';

test.beforeEach(authReset);

test.describe.serial('Phase 11 — Advertiser Dashboard', () => {

  test('11.1 — Login as Advertiser', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    const role = await page.evaluate(() => localStorage.getItem('demo_role'));
    expect(role).toBe('advertiser');
    // Confirm x-demo-role: advertiser on first API call
    let capturedRole = '';
    await page.route('**/api/**', async (route) => {
      capturedRole = route.request().headers()['x-demo-role'] || '';
      await route.continue();
    });
    await page.goto(`${BASE_URL}/dashboard/advertiser`);
    await page.waitForTimeout(500);
    expect(capturedRole).toBe('advertiser');
  });

  test('11.2 — Advertiser Dashboard renders; KPIs load; no 403', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(getLocator(page, BL.AdvertiserDashboard)).toBeVisible();
    // KPI widgets must load (not stuck in loading state)
    const loadingSpinners = page.locator('[data-testid="kpi-loading"]');
    await expect(loadingSpinners).toHaveCount(0);
  });

  test('11.3 — Demo campaign visible with Approved status (from Phase 8)', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser`);
    await expect(page.getByText('BonVie Summer Demo')).toBeVisible();
    await expect(page.locator('[data-testid="campaign-status"]').filter({ hasText: 'Approved' })).toBeVisible();
  });

  // ─── Gap 2 Negative: Wrong-role access to admin route ────────────────────────
  test('11.NEG — Advertiser accessing /dashboard/admin/retailers → 403 or redirect', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/admin/retailers`);
    // Must either 403 or redirect away from the admin route
    const url = page.url();
    const isRedirected = !url.includes('/admin/retailers') || url.includes('/dashboard/advertiser') || url.includes('/login');
    // OR: the admin content must not be rendered
    const adminContent = page.locator('[data-testid="admin-retailers"]');
    const adminVisible = await adminContent.isVisible().catch(() => false);
    expect(isRedirected || !adminVisible).toBe(true);
  });

});
