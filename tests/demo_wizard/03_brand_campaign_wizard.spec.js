/**
 * Phase 3 — Brand Campaign Wizard
 *
 * Persona: DEMO_BRAND
 * Steps:
 *   3.1  Login as Brand
 *   3.2  Open Campaign Wizard
 *   3.3  Step 1 — Location & schedule selection
 *   3.4  Step 2 — Slot configuration
 *   3.5  Step 3 — Creative upload (tests/test-ad.png)
 *   3.6  Step 4 — Review
 *   3.7  Submit wizard → redirect to brand dashboard
 *   3.8  Campaign visible in brand dashboard list
 *
 * assertRoleHeader fires on POST /api/campaigns (step 3.7).
 * This is the highest-risk phase — 5 sequential form interactions with
 * state carried across steps via wizard context.
 *
 * Gap 2 closure (N-3.1):
 *   No screens selected on Step 1 → Next button must be disabled OR
 *   inline validation error shown. Wizard must not advance. No API call.
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

test.describe.serial('Phase 3 — Brand Campaign Wizard', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  test('3.1 login as Brand', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await expect(page.locator('[data-testid="dashboard-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-brand"]')).toBeVisible();
  });

  test('3.2 open Campaign Wizard', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns/new', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaign-wizard"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="wizard-step-1"]')).toBeVisible();
  });

  test('3.3 Step 1 — select location and schedule', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns/new', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaign-wizard"]', { timeout: 15000 });

    // Select retailer: FreshMart
    await page.selectOption('[data-testid="wizard-select-retailer"]', SEED.retailerId);
    // Select first available screen
    await page.check(`[data-testid="wizard-screen-${SEED.screenIds[0]}"]`);
    // Set campaign date range
    await page.fill('[data-testid="wizard-input-start-date"]', '2026-07-01');
    await page.fill('[data-testid="wizard-input-end-date"]',   '2026-07-31');

    await page.click('[data-testid="wizard-btn-next"]');
    await expect(page.locator('[data-testid="wizard-step-2"]')).toBeVisible({ timeout: 10000 });
  });

  test('3.4 Step 2 — configure slots', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns/new', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaign-wizard"]', { timeout: 15000 });

    // Complete Step 1 quickly
    await page.selectOption('[data-testid="wizard-select-retailer"]', SEED.retailerId);
    await page.check(`[data-testid="wizard-screen-${SEED.screenIds[0]}"]`);
    await page.fill('[data-testid="wizard-input-start-date"]', '2026-07-01');
    await page.fill('[data-testid="wizard-input-end-date"]',   '2026-07-31');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');

    // Step 2: slot count
    await page.fill('[data-testid="wizard-input-slot-count"]', '2');
    await page.click('[data-testid="wizard-btn-next"]');
    await expect(page.locator('[data-testid="wizard-step-3"]')).toBeVisible({ timeout: 10000 });
  });

  test('3.5 Step 3 — upload creative', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns/new', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaign-wizard"]', { timeout: 15000 });

    // Fast-forward through steps 1–2
    await page.selectOption('[data-testid="wizard-select-retailer"]', SEED.retailerId);
    await page.check(`[data-testid="wizard-screen-${SEED.screenIds[0]}"]`);
    await page.fill('[data-testid="wizard-input-start-date"]', '2026-07-01');
    await page.fill('[data-testid="wizard-input-end-date"]',   '2026-07-31');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    await page.fill('[data-testid="wizard-input-slot-count"]', '2');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');

    // Upload test-ad.png
    const fileInput = page.locator('[data-testid="wizard-file-upload"]');
    await fileInput.setInputFiles('tests/test-ad.png');
    await expect(page.locator('[data-testid="wizard-upload-preview"]')).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="wizard-btn-next"]');
    await expect(page.locator('[data-testid="wizard-step-4"]')).toBeVisible({ timeout: 10000 });
  });

  test('3.6 Step 4 — review summary', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns/new', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaign-wizard"]', { timeout: 15000 });

    await page.selectOption('[data-testid="wizard-select-retailer"]', SEED.retailerId);
    await page.check(`[data-testid="wizard-screen-${SEED.screenIds[0]}"]`);
    await page.fill('[data-testid="wizard-input-start-date"]', '2026-07-01');
    await page.fill('[data-testid="wizard-input-end-date"]',   '2026-07-31');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    await page.fill('[data-testid="wizard-input-slot-count"]', '2');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    await page.locator('[data-testid="wizard-file-upload"]').setInputFiles('tests/test-ad.png');
    await page.waitForSelector('[data-testid="wizard-upload-preview"]');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-4"]');

    // Review page must show the retailer and screen selection
    await expect(page.locator('[data-testid="wizard-review-retailer"]')).toBeVisible();
    await expect(page.locator('[data-testid="wizard-review-screens"]')).toBeVisible();
  });

  test('3.7 submit wizard → POST /api/campaigns with brand role header', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns/new', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaign-wizard"]', { timeout: 15000 });

    await page.selectOption('[data-testid="wizard-select-retailer"]', SEED.retailerId);
    await page.check(`[data-testid="wizard-screen-${SEED.screenIds[0]}"]`);
    await page.fill('[data-testid="wizard-input-start-date"]', '2026-07-01');
    await page.fill('[data-testid="wizard-input-end-date"]',   '2026-07-31');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    await page.fill('[data-testid="wizard-input-slot-count"]', '2');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    await page.locator('[data-testid="wizard-file-upload"]').setInputFiles('tests/test-ad.png');
    await page.waitForSelector('[data-testid="wizard-upload-preview"]');
    await page.click('[data-testid="wizard-btn-next"]');
    await page.waitForSelector('[data-testid="wizard-step-4"]');

    const assertHeader = await assertRoleHeader(page, DEMO_BRAND.role, '/api/campaigns');
    await page.click('[data-testid="wizard-btn-submit"]');
    await assertHeader();

    // Must redirect to brand dashboard after submit
    await page.waitForURL('**/dashboard/brand**', { timeout: 15000 });
  });

  test('3.8 campaign visible in brand dashboard list', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaigns-list"]', { timeout: 15000 });
    await expect(
      page.locator('[data-testid="campaigns-list"] [data-testid^="campaign-row-"]').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // N-3.1 — Gap 2: no screens selected → Next disabled or inline validation
  // ─────────────────────────────────────────────────────────────────────────
  test('N-3.1 no screens selected on Step 1 → Next disabled or validation error, no route advance', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns/new', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="campaign-wizard"]', { timeout: 15000 });

    // Fill retailer and dates but leave ALL screen checkboxes unchecked
    await page.selectOption('[data-testid="wizard-select-retailer"]', SEED.retailerId);
    await page.fill('[data-testid="wizard-input-start-date"]', '2026-07-01');
    await page.fill('[data-testid="wizard-input-end-date"]',   '2026-07-31');
    // Explicitly uncheck all screens in case they default to checked
    const screenCheckboxes = page.locator('[data-testid^="wizard-screen-"]');
    const count = await screenCheckboxes.count();
    for (let i = 0; i < count; i++) {
      await screenCheckboxes.nth(i).uncheck();
    }

    await page.click('[data-testid="wizard-btn-next"]');

    // Either the button is disabled OR an error is shown — both are acceptable
    const nextBtn = page.locator('[data-testid="wizard-btn-next"]');
    const validationMsg = page.locator(
      '[data-testid="error-screen-selection"], [data-testid="validation-error"], [role="alert"]',
    );

    const isDisabled = await nextBtn.isDisabled().catch(() => false);
    const hasError   = await validationMsg.first().isVisible({ timeout: 2000 }).catch(() => false);

    expect(
      isDisabled || hasError,
      'With no screens selected, Next button must be disabled OR a validation error must be shown',
    ).toBe(true);

    // Step 2 must NOT be visible — wizard must not have advanced
    await expect(page.locator('[data-testid="wizard-step-2"]')).not.toBeVisible();
  });

});
