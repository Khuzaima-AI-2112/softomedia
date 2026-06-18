/**
 * Phase 3 — Brand Campaign Wizard (5-Step)
 *
 * Persona: DEMO_BRAND
 * Steps:
 *   3.1  Login as Brand
 *   3.2  Open Campaign Wizard
 *   3.3  Step 1 — Location: select FreshMart, both stores, all 4 screens
 *   3.4  Step 2 — Schedule: name, date range, budget
 *   3.5  Step 3 — Slots: select peak hourly slots
 *   3.6  Step 4 — Creative: upload tests/test-ad.png, set duration 15s
 *   3.7  Step 5 — Review + Submit: assert POST /api/campaigns fires with correct role header
 *   3.8  Post-submit: assert redirect to Brand Dashboard, campaign in list
 *
 * This is the highest-risk phase.
 * - 5 sequential form interactions with state carried across steps via wizard context
 * - Creative upload touches the file input path (not mocked)
 * - The POST /api/campaigns must be live (stub returns 201 + demo id)
 * - assertRoleHeader fires on Step 3.7 to confirm brand auth header
 *
 * Note on selector pattern:
 *   The wizard uses a step-index data attribute: data-testid="wizard-step-{n}"
 *   Each step container is rendered via React state (not routing), so
 *   waitForSelector on the next step container is the correct completion signal.
 */

import path from 'path';
import { test, expect } from '@playwright/test';
import {
  DEMO_BRAND,
  BASE_URL,
  SEED,
  authReset,
  loginAs,
  assertRoleHeader,
} from './demo.fixtures.js';

// Path to the test creative asset (committed to the repo)
const TEST_AD_PATH = path.resolve('tests/test-ad.png');

test.describe.serial('Phase 3 — Brand Campaign Wizard', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.1 — Login
  // ─────────────────────────────────────────────────────────────────────────
  test('3.1 login as Brand', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await expect(page.locator('[data-testid="dashboard-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-brand"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.2 — Open Campaign Wizard
  // ─────────────────────────────────────────────────────────────────────────
  test('3.2 open Campaign Wizard', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(
      BASE_URL + '/dashboard/brand/campaigns',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="brand-campaigns-list"]');

    await page.click('[data-testid="btn-new-campaign"]');
    await page.waitForSelector('[data-testid="wizard-step-1"]');
    await expect(page.locator('[data-testid="wizard-step-1"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.3 — Wizard Step 1: Location
  // ─────────────────────────────────────────────────────────────────────────
  test('3.3 wizard Step 1 — select FreshMart, both stores, all 4 screens', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns', { waitUntil: 'domcontentloaded' });
    await page.click('[data-testid="btn-new-campaign"]');
    await page.waitForSelector('[data-testid="wizard-step-1"]');

    // Select retailer
    await page.click(`[data-testid="retailer-option-${SEED.retailerId}"]`);

    // Both stores should become visible; select them both
    await page.click('[data-testid="store-option-demo-store-downtown"]');
    await page.click('[data-testid="store-option-demo-store-plateau"]');

    // All 4 screens should become available; select all
    for (const screenId of SEED.screenIds) {
      await page.click(`[data-testid="screen-option-${screenId}"]`);
    }

    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    await expect(page.locator('[data-testid="wizard-step-2"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.4 — Wizard Step 2: Schedule
  // ─────────────────────────────────────────────────────────────────────────
  test('3.4 wizard Step 2 — name, date range, budget', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns', { waitUntil: 'domcontentloaded' });
    await page.click('[data-testid="btn-new-campaign"]');
    await page.waitForSelector('[data-testid="wizard-step-1"]');

    // Re-complete Step 1 (wizard state resets on navigation)
    await page.click(`[data-testid="retailer-option-${SEED.retailerId}"]`);
    await page.click('[data-testid="store-option-demo-store-downtown"]');
    await page.click('[data-testid="store-option-demo-store-plateau"]');
    for (const screenId of SEED.screenIds) {
      await page.click(`[data-testid="screen-option-${screenId}"]`);
    }
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');

    // Fill Schedule step
    await page.fill('[data-testid="input-campaign-name"]', 'BonVie Summer Demo');

    const today = new Date();
    const todayStr    = today.toISOString().split('T')[0];
    const weekOutStr  = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

    await page.fill('[data-testid="input-campaign-start"]', todayStr);
    await page.fill('[data-testid="input-campaign-end"]',   weekOutStr);
    await page.fill('[data-testid="input-campaign-budget"]', '2000');

    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    await expect(page.locator('[data-testid="wizard-step-3"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.5 — Wizard Step 3: Slots
  // ─────────────────────────────────────────────────────────────────────────
  test('3.5 wizard Step 3 — select peak hourly slots', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns', { waitUntil: 'domcontentloaded' });
    await page.click('[data-testid="btn-new-campaign"]');
    await page.waitForSelector('[data-testid="wizard-step-1"]');

    // Re-complete Steps 1 & 2
    await page.click(`[data-testid="retailer-option-${SEED.retailerId}"]`);
    await page.click('[data-testid="store-option-demo-store-downtown"]');
    await page.click('[data-testid="store-option-demo-store-plateau"]');
    for (const screenId of SEED.screenIds) {
      await page.click(`[data-testid="screen-option-${screenId}"]`);
    }
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    const today = new Date();
    await page.fill('[data-testid="input-campaign-name"]', 'BonVie Summer Demo');
    await page.fill('[data-testid="input-campaign-start"]', today.toISOString().split('T')[0]);
    await page.fill('[data-testid="input-campaign-end"]',   new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]);
    await page.fill('[data-testid="input-campaign-budget"]', '2000');
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');

    // Select the seeded peak slots (noon + 17:00–19:00 band)
    await page.click('[data-testid="slot-option-12"]');
    await page.click('[data-testid="slot-option-17"]');
    await page.click('[data-testid="slot-option-18"]');

    // Verify at least one slot chip is rendered as selected
    await expect(
      page.locator('[data-testid="slot-option-12"][data-selected="true"]'),
    ).toBeVisible({ timeout: 5000 });

    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-4"]');
    await expect(page.locator('[data-testid="wizard-step-4"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.6 — Wizard Step 4: Creative Upload
  // ─────────────────────────────────────────────────────────────────────────
  test('3.6 wizard Step 4 — upload test-ad.png, set duration 15s', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns', { waitUntil: 'domcontentloaded' });
    await page.click('[data-testid="btn-new-campaign"]');
    await page.waitForSelector('[data-testid="wizard-step-1"]');

    // Re-complete Steps 1–3
    await page.click(`[data-testid="retailer-option-${SEED.retailerId}"]`);
    await page.click('[data-testid="store-option-demo-store-downtown"]');
    await page.click('[data-testid="store-option-demo-store-plateau"]');
    for (const screenId of SEED.screenIds) {
      await page.click(`[data-testid="screen-option-${screenId}"]`);
    }
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    const today = new Date();
    await page.fill('[data-testid="input-campaign-name"]', 'BonVie Summer Demo');
    await page.fill('[data-testid="input-campaign-start"]', today.toISOString().split('T')[0]);
    await page.fill('[data-testid="input-campaign-end"]',   new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]);
    await page.fill('[data-testid="input-campaign-budget"]', '2000');
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    await page.click('[data-testid="slot-option-12"]');
    await page.click('[data-testid="slot-option-17"]');
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-4"]');

    // Upload the test creative
    const fileInput = page.locator('[data-testid="input-creative-file"]');
    await fileInput.setInputFiles(TEST_AD_PATH);

    // Wait for upload preview to confirm the file was accepted
    await expect(
      page.locator('[data-testid="creative-preview"]'),
    ).toBeVisible({ timeout: 15000 });

    // Set display duration
    await page.fill('[data-testid="input-creative-duration"]', '15');

    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-5"]');
    await expect(page.locator('[data-testid="wizard-step-5"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.7 — Wizard Step 5: Review + Submit
  // ─────────────────────────────────────────────────────────────────────────
  test('3.7 wizard Step 5 — review summary correct, submit campaign', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(BASE_URL + '/dashboard/brand/campaigns', { waitUntil: 'domcontentloaded' });
    await page.click('[data-testid="btn-new-campaign"]');
    await page.waitForSelector('[data-testid="wizard-step-1"]');

    // Re-complete Steps 1–4
    await page.click(`[data-testid="retailer-option-${SEED.retailerId}"]`);
    await page.click('[data-testid="store-option-demo-store-downtown"]');
    await page.click('[data-testid="store-option-demo-store-plateau"]');
    for (const screenId of SEED.screenIds) {
      await page.click(`[data-testid="screen-option-${screenId}"]`);
    }
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-2"]');
    const today = new Date();
    await page.fill('[data-testid="input-campaign-name"]', 'BonVie Summer Demo');
    await page.fill('[data-testid="input-campaign-start"]', today.toISOString().split('T')[0]);
    await page.fill('[data-testid="input-campaign-end"]',   new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]);
    await page.fill('[data-testid="input-campaign-budget"]', '2000');
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-3"]');
    await page.click('[data-testid="slot-option-12"]');
    await page.click('[data-testid="slot-option-17"]');
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-4"]');
    await page.locator('[data-testid="input-creative-file"]').setInputFiles(TEST_AD_PATH);
    await page.waitForSelector('[data-testid="creative-preview"]');
    await page.fill('[data-testid="input-creative-duration"]', '15');
    await page.click('[data-testid="wizard-next"]');
    await page.waitForSelector('[data-testid="wizard-step-5"]');

    // Assert review summary contains the values entered across all steps
    await expect(page.locator('[data-testid="review-campaign-name"]')).toContainText('BonVie Summer Demo');
    await expect(page.locator('[data-testid="review-retailer-name"]')).toContainText('FreshMart');
    await expect(page.locator('[data-testid="review-budget"]')).toContainText('2000');
    await expect(page.locator('[data-testid="review-screen-count"]')).toContainText('4');

    // Set up role header assertion before clicking submit
    const assertHeader = await assertRoleHeader(page, DEMO_BRAND.role, '/api/campaigns');
    await page.click('[data-testid="wizard-submit"]');
    await assertHeader();

    // Wizard should close and redirect to campaign list
    await page.waitForSelector('[data-testid="wizard-step-1"]', { state: 'hidden' });
    await page.waitForSelector('[data-testid="brand-campaigns-list"]');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3.8 — Post-submit: campaign visible in Brand Dashboard
  // ─────────────────────────────────────────────────────────────────────────
  test('3.8 campaign appears in Brand Dashboard campaign list', async ({ page }) => {
    await loginAs(page, DEMO_BRAND);
    await page.goto(
      BASE_URL + '/dashboard/brand/campaigns',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="brand-campaigns-list"]');

    // The campaign submitted in 3.7 must be visible in the list.
    // Status will be 'pending_approval' (pre-approval gate in Phase 8).
    await expect(
      page.locator('[data-testid="brand-campaigns-list"]').getByText('BonVie Summer Demo'),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.locator('[data-testid="campaign-status-badge"]').first(),
    ).toContainText(/pending/i);
  });

});
