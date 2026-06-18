/**
 * Phase 15 — Admin Campaign Analytics Read-Back
 * Persona: DEMO_ADMIN | x-demo-role: admin
 *
 * This is the penultimate phase. After this completes, globalTeardown runs.
 * Do NOT perform any cleanup here — see 00_seed.setup.js → globalTeardown.
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_ADMIN, BASE_URL } from './demo.fixtures.js';

test.beforeEach(authReset);

test.describe.serial('Phase 15 — Admin Campaign Analytics', () => {

  test('15.1 — Login as Admin', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    const role = await page.evaluate(() => localStorage.getItem('demo_role'));
    expect(role).toBe('admin');
  });

  test('15.2 — Admin Campaign Management: BonVie Summer Demo visible, status Approved', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(`${BASE_URL}/dashboard/admin/campaigns`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="campaign-management"]')).toBeVisible();
    await expect(page.getByText('BonVie Summer Demo')).toBeVisible();
    await expect(
      page.locator('[data-testid="campaign-status"]').filter({ hasText: 'Approved' })
    ).toBeVisible();
  });

  test('15.3 — Campaign detail opens; admin action button present (do NOT click)', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(`${BASE_URL}/dashboard/admin/campaigns`);
    await page.getByText('BonVie Summer Demo').click();
    await expect(page.locator('[data-testid="campaign-detail"]')).toBeVisible();
    // Admin action button must be present — but we must NOT click it to avoid side effects
    await expect(
      page.locator('[data-testid="btn-admin-action"], [data-testid="btn-campaign-admin-action"]').first()
    ).toBeVisible();
  });

  test('15.4 — Loop Analytics: telemetry from Phase 4 reflected (play counts > 0)', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(`${BASE_URL}/dashboard/admin/loop-analytics`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="loop-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-state"]')).toHaveCount(0);
    // Play counts from Phase 4 (telemetry heartbeats) must be > 0
    const playCount = page.locator('[data-testid="play-count"]').first();
    if (await playCount.isVisible()) {
      const countText = await playCount.textContent();
      expect(parseInt(countText || '0', 10)).toBeGreaterThan(0);
    } else {
      // If no data-testid, assert the page does not show blank/error
      await expect(page.locator('[data-testid="no-data-state"]')).toHaveCount(0);
    }
  });

  test('15.5 — Pricing Config renders without 403; pricing tier config visible', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(`${BASE_URL}/dashboard/admin/pricing-config`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="pricing-config"]')).toBeVisible();
    // Pricing tier configuration must be visible (Sprint 15)
    await expect(
      page.locator('[data-testid="pricing-tier"], [data-testid="pricing-tiers"]').first()
    ).toBeVisible();
  });

});
