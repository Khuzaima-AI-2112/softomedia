/**
 * Phase 3 — Brand Campaign Wizard (Refactored for S22-1 Single Page Modal)
 *
 * Persona: DEMO_BRAND
 * Steps:
 *   3.1  Login as Brand
 *   3.2  Open Campaign Wizard Modal from Dashboard
 *   3.3  Fill out campaign creation form
 *   3.4  Submit wizard → redirect/close modal
 *   3.5  Campaign visible in brand dashboard list
 *
 * assertRoleHeader fires on POST /api/campaigns (step 3.4).
 *
 * Gap 2 closure (N-3.1):
 *   No dates selected on form → Submit button shows HTML5 validation or 
 *   inline validation error shown. Form must not submit.
 */

import { test, expect } from '@playwright/test';
import {
  DEMO_BRAND,
  BASE_URL,
  SEED,
  authReset,
  loginAs,
  assertRoleHeader,
} from './demo.fixtures.js';

import { AdminLocators as AL } from './admin_locators.js';
import { BrandLocators as BL } from './brand_locators.js';
import { WizardLocators as WL, getLocator } from './wizard_locators.js';

// Reusing SEED but adapting to new form
const CAMP_NAME = 'Summer Sale 2026 ' + Date.now();

test.describe.serial('Phase 3 — Brand Campaign Wizard', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  test('3.1 login as Brand', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await expect(getLocator(page, AL.Shell)).toBeVisible();
    await expect(getLocator(page, BL.NavBrand)).toBeVisible();
  });

  test('3.2 open Campaign Wizard', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/advertiser/campaigns', { waitUntil: 'domcontentloaded' });
    await getLocator(page, BL.AdvertiserCampaigns).waitFor({ timeout: 15000 });

    // Click New Campaign to trigger modal
    await getLocator(page, BL.BtnNewCampaign).first().click();
    await getLocator(page, WL.CampaignWizardModal).waitFor({ timeout: 10000 });
  });

  test('3.3 Fill out campaign creation form', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/advertiser/campaigns', { waitUntil: 'domcontentloaded' });
    await getLocator(page, BL.AdvertiserCampaigns).waitFor({ timeout: 15000 });

    await getLocator(page, BL.BtnNewCampaign).first().click();
    await getLocator(page, WL.CampaignWizardModal).waitFor({ timeout: 10000 });

    // Fill the new streamlined fields
    await getLocator(page, WL.InputCampaignName).fill(CAMP_NAME);
    await getLocator(page, WL.SelectRetailer).selectOption({ label: 'FreshMart Montréal' });
    await getLocator(page, WL.InputStartDate).fill('2026-07-01');
    await getLocator(page, WL.InputEndDate).fill('2026-07-31');
    await getLocator(page, WL.InputBudget).fill('5000');
    await getLocator(page, WL.InputCreative).fill('https://cdn.example.com/ad.mp4');

    await expect(getLocator(page, WL.BtnSubmit)).toBeEnabled();
  });

  test('3.4 submit wizard → POST /api/campaigns with brand role header', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/advertiser/campaigns', { waitUntil: 'domcontentloaded' });
    await getLocator(page, BL.AdvertiserCampaigns).waitFor({ timeout: 15000 });

    await getLocator(page, BL.BtnNewCampaign).first().click();
    await getLocator(page, WL.CampaignWizardModal).waitFor({ timeout: 10000 });

    await getLocator(page, WL.InputCampaignName).fill(CAMP_NAME);
    await getLocator(page, WL.SelectRetailer).selectOption({ label: 'FreshMart Montréal' });
    await getLocator(page, WL.InputStartDate).fill('2026-07-01');
    await getLocator(page, WL.InputEndDate).fill('2026-07-31');
    await getLocator(page, WL.InputCreative).fill('https://cdn.example.com/ad.mp4');

    const assertHeader = await assertRoleHeader(page, DEMO_BRAND.role, '/api/campaigns');
    await getLocator(page, WL.BtnSubmit).click();
    await assertHeader();

    // Modal should close and parent should reflect it
    await expect(getLocator(page, WL.CampaignWizardModal)).not.toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // N-3.1 — Gap 2: Required validation prevents API call
  // ─────────────────────────────────────────────────────────────────────────
  test('N-3.1 missing required fields → validation error, no API bypass', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/advertiser/campaigns', { waitUntil: 'domcontentloaded' });
    await getLocator(page, BL.AdvertiserCampaigns).waitFor({ timeout: 15000 });

    await getLocator(page, BL.BtnNewCampaign).first().click();
    await getLocator(page, WL.CampaignWizardModal).waitFor({ timeout: 10000 });

    // Leave name empty to trigger validation
    await getLocator(page, WL.SelectRetailer).selectOption({ label: 'FreshMart Montréal' });

    await getLocator(page, WL.BtnSubmit).click();

    // Modal must still be visible (not submitted)
    await expect(getLocator(page, WL.CampaignWizardModal)).toBeVisible();

    // Look for error message
    const errMsg = page.locator('#err-name, [role="alert"]');
    await expect(errMsg.first()).toBeVisible({ timeout: 5000 });
  });

});
