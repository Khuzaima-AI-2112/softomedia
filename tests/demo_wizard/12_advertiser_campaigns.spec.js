/**
 * Phase 12 — Advertiser Campaign Management
 * Persona: DEMO_ADVERTISER | x-demo-role: advertiser
 *
 * Key: AdvertiserNewCampaign.jsx was retired in S22-1.
 * Campaign creation is now via CampaignWizardModal (inline modal, not a route).
 * Step 12.2 validates the /campaigns/new redirect is live.
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_ADVERTISER, BASE_URL } from './demo.fixtures.js';
import { getLocator, AdminLocators as AL } from './admin_locators.js';
import { BrandLocators as BL } from './brand_locators.js';
import { WizardLocators as WL } from './wizard_locators.js';

test.beforeEach(authReset);

test.describe.serial('Phase 12 — Advertiser Campaign Management', () => {

  test('12.1 — Navigate to Advertiser Campaigns; BonVie campaign in list', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser/campaigns`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(getLocator(page, BL.AdvertiserCampaigns)).toBeVisible();
    await expect(page.getByText('BonVie Summer Demo')).toBeVisible();
  });

  test('12.2 — /campaigns/new redirects to /campaigns (S22-1 retirement)', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser/campaigns/new`);
    // Must redirect — not 404
    await expect(page).not.toHaveURL(/404/);
    await expect(page).toHaveURL(/\/dashboard\/advertiser\/campaigns/);
    // The old AdvertiserNewCampaign page must not render
    await expect(getLocator(page, WL.AdvertiserNewCampaignPage)).toHaveCount(0);
  });

  test('12.3 — New Campaign button opens CampaignWizardModal inline (not route)', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser/campaigns`);
    const urlBefore = page.url();
    await getLocator(page, BL.BtnNewCampaign).click();
    // Must NOT navigate to a new route
    expect(page.url()).toBe(urlBefore);
    // Modal Step 1 must render
    await expect(getLocator(page, WL.CampaignWizardModal)).toBeVisible();
    await expect(getLocator(page, WL.Step1)).toBeVisible();
  });

  test('12.4 — Dismiss modal; campaign list unchanged; no orphaned wizard state', async ({ page }) => {
    await loginAs(page, DEMO_ADVERTISER);
    await page.goto(`${BASE_URL}/dashboard/advertiser/campaigns`);
    await getLocator(page, BL.BtnNewCampaign).click();
    await expect(getLocator(page, WL.CampaignWizardModal)).toBeVisible();
    // Dismiss via close button or Escape
    const closeBtn = page.locator('[data-testid="btn-modal-close"], [aria-label="Close"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(getLocator(page, WL.CampaignWizardModal)).toHaveCount(0);
    // Campaign list must still show BonVie Summer Demo
    await expect(page.getByText('BonVie Summer Demo')).toBeVisible();
    // No wizard step artifacts left in DOM
    await expect(getLocator(page, WL.Step1)).toHaveCount(0);
  });

});
