/**
 * Phase 13 — Advertiser Invoices
 * Persona: DEMO_ADVERTISER | x-demo-role: advertiser
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_ADVERTISER, BASE_URL } from './demo.fixtures.js';

test.beforeEach(authReset);

test.describe.serial('Phase 13 — Advertiser Invoices', () => {

  test('13.1 — Navigate to Invoices; renders without 403 or blank', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser/invoices`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="invoices"]')).toBeVisible();
    // Must not show an error state or blank white screen
    await expect(page.locator('[data-testid="error-state"]')).toHaveCount(0);
  });

  test('13.2 — Invoice for demo campaign present; amount non-zero', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser/invoices`);
    // At least one invoice row must reference BonVie Summer Demo or demo-campaign-001
    const campaignRef = page.locator('[data-testid="invoice-row"]').filter({
      hasText: /BonVie Summer Demo|demo-campaign-001/,
    });
    await expect(campaignRef.first()).toBeVisible();
    // Amount must be non-zero — look for any non-$0.00 / non-€0 value
    const amountCell = campaignRef.locator('[data-testid="invoice-amount"]').first();
    const amountText = await amountCell.textContent();
    expect(amountText).not.toMatch(/^\$?0\.00$/);
    expect(amountText?.trim()).not.toBe('');
  });

  test('13.3 — Invoice download or detail view accessible', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser/invoices`);
    const downloadBtn = page.locator('[data-testid="btn-invoice-download"]').first();
    const detailLink = page.locator('[data-testid="invoice-row"]').first();

    if (await downloadBtn.isVisible()) {
      // If a download button exists, assert the download event fires
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadBtn.click(),
      ]);
      expect(download).not.toBeNull();
    } else {
      // Otherwise, clicking the row must open an invoice detail view
      await detailLink.click();
      await expect(
        page.locator('[data-testid="invoice-detail"], [data-testid="invoice-detail-view"]').first()
      ).toBeVisible();
    }
  });

});
