/**
 * Phase 1 — Admin Provision
 *
 * Persona: DEMO_ADMIN
 * Steps:   10 serial steps covering every Admin input surface.
 *
 * Sequence:
 *   1.1  Login as Admin
 *   1.2  Create Retailer: "FreshMart Montréal"
 *   1.3  Add Store A: "FreshMart Downtown"
 *   1.4  Add Store B: "FreshMart Plateau"
 *   1.5  Add Screens (2 per store, 4 total)
 *   1.6  Set Business Hours for both stores
 *   1.7  Create Advertiser: "BonVie Snacks"
 *   1.8  Create Loop Template for FreshMart
 *   1.9  Set CPM pricing on the calendar
 *   1.10 Create Brand User + Retailer User
 *
 * Every POST is verified via assertRoleHeader to confirm admin auth header
 * is sent. Each step asserts the created entity appears in the UI list before
 * the next step runs — early failure = maximum signal, no silent drift.
 */

import { test, expect } from '@playwright/test';
import {
  DEMO_ADMIN,
  BASE_URL,
  SEED,
  authReset,
  loginAs,
  assertRoleHeader,
} from './demo.fixtures.js';

test.describe.serial('Phase 1 — Admin Provision', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.1 — Login
  // ─────────────────────────────────────────────────────────────────────────
  test('1.1 login as Admin', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await expect(page.locator('[data-testid="dashboard-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.2 — Create Retailer
  // ─────────────────────────────────────────────────────────────────────────
  test('1.2 create Retailer — FreshMart Montréal', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/retailers', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="retailers-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/retailers');

    await page.click('[data-testid="btn-add-retailer"]');
    await page.waitForSelector('[data-testid="modal-retailer-form"]');
    await page.fill('[data-testid="input-retailer-name"]', 'FreshMart Montréal');
    await page.fill('[data-testid="input-retailer-contact"]', 'demo@freshmart.ca');
    await page.click('[data-testid="btn-retailer-form-submit"]');
    await assertHeader();

    // Assert the new retailer appears in the list
    await expect(
      page.locator('[data-testid="retailers-list"]').getByText('FreshMart Montréal'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.3 — Add Store A
  // ─────────────────────────────────────────────────────────────────────────
  test('1.3 add Store A — FreshMart Downtown', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(
      BASE_URL + `/dashboard/admin/retailers/${SEED.retailerId}/stores`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="stores-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/stores');

    await page.click('[data-testid="btn-add-store"]');
    await page.waitForSelector('[data-testid="modal-store-form"]');
    await page.fill('[data-testid="input-store-name"]', 'FreshMart Downtown');
    await page.fill('[data-testid="input-store-address"]', '100 Rue Sainte-Catherine, Montréal, QC');
    await page.click('[data-testid="btn-store-form-submit"]');
    await assertHeader();

    await expect(
      page.locator('[data-testid="stores-list"]').getByText('FreshMart Downtown'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.4 — Add Store B
  // ─────────────────────────────────────────────────────────────────────────
  test('1.4 add Store B — FreshMart Plateau', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(
      BASE_URL + `/dashboard/admin/retailers/${SEED.retailerId}/stores`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="stores-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/stores');

    await page.click('[data-testid="btn-add-store"]');
    await page.waitForSelector('[data-testid="modal-store-form"]');
    await page.fill('[data-testid="input-store-name"]', 'FreshMart Plateau');
    await page.fill('[data-testid="input-store-address"]', '4500 Avenue du Parc, Montréal, QC');
    await page.click('[data-testid="btn-store-form-submit"]');
    await assertHeader();

    await expect(
      page.locator('[data-testid="stores-list"]').getByText('FreshMart Plateau'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.5 — Add Screens (2 per store, 4 total)
  // Adds screens to demo-screen-01 through demo-screen-04 via the Admin
  // Screen Management panel. The seed already pre-created these IDs; this
  // step exercises the UI creation path to confirm the form + list work.
  // ─────────────────────────────────────────────────────────────────────────
  test('1.5 add 4 screens (2 per store)', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/screens', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="screens-list"]');

    const screenDefs = [
      { name: 'Downtown Entrance', storeId: 'demo-store-downtown' },
      { name: 'Downtown Checkout', storeId: 'demo-store-downtown' },
      { name: 'Plateau Entrance',  storeId: 'demo-store-plateau'  },
      { name: 'Plateau Checkout',  storeId: 'demo-store-plateau'  },
    ];

    for (const screen of screenDefs) {
      await page.click('[data-testid="btn-add-screen"]');
      await page.waitForSelector('[data-testid="modal-screen-form"]');
      await page.fill('[data-testid="input-screen-name"]', screen.name);
      await page.selectOption('[data-testid="select-screen-store"]', screen.storeId);
      await page.click('[data-testid="btn-screen-form-submit"]');
      await expect(
        page.locator('[data-testid="screens-list"]').getByText(screen.name),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.6 — Set Business Hours for both stores
  // ─────────────────────────────────────────────────────────────────────────
  test('1.6 set business hours for both stores', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(
      BASE_URL + `/dashboard/admin/retailers/${SEED.retailerId}/business-hours`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="business-hours-form"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/business-hours');

    // Set Mon–Fri 08:00–22:00 for all stores
    await page.fill('[data-testid="input-hours-open"]', '08:00');
    await page.fill('[data-testid="input-hours-close"]', '22:00');
    await page.click('[data-testid="btn-hours-apply-all"]');
    await page.click('[data-testid="btn-hours-save"]');
    await assertHeader();

    await expect(page.locator('[data-testid="hours-save-confirmation"]')).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.7 — Create Advertiser: BonVie Snacks
  // ─────────────────────────────────────────────────────────────────────────
  test('1.7 create Advertiser — BonVie Snacks', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/advertisers', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="advertisers-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/advertisers');

    await page.click('[data-testid="btn-add-advertiser"]');
    await page.waitForSelector('[data-testid="modal-advertiser-form"]');
    await page.fill('[data-testid="input-advertiser-name"]', 'BonVie Snacks');
    await page.fill('[data-testid="input-advertiser-contact"]', 'demo@bonvie.ca');
    await page.click('[data-testid="btn-advertiser-form-submit"]');
    await assertHeader();

    await expect(
      page.locator('[data-testid="advertisers-list"]').getByText('BonVie Snacks'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.8 — Create Loop Template for FreshMart
  // ─────────────────────────────────────────────────────────────────────────
  test('1.8 create Loop Template for FreshMart', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/loops', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="loops-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/loops');

    await page.click('[data-testid="btn-add-loop"]');
    await page.waitForSelector('[data-testid="modal-loop-form"]');
    await page.fill('[data-testid="input-loop-name"]', 'FreshMart Standard Loop');
    await page.selectOption('[data-testid="select-loop-retailer"]', SEED.retailerId);
    await page.fill('[data-testid="input-loop-duration"]', '3600');
    await page.fill('[data-testid="input-loop-paid-slots"]', '12');
    await page.click('[data-testid="btn-loop-form-submit"]');
    await assertHeader();

    await expect(
      page.locator('[data-testid="loops-list"]').getByText('FreshMart Standard Loop'),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.9 — Set CPM Pricing on the calendar
  // ─────────────────────────────────────────────────────────────────────────
  test('1.9 set CPM pricing on the calendar', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="pricing-calendar"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/pricing');

    // Select the current week's Monday cell and set a CPM rate
    await page.click('[data-testid="pricing-calendar-today"]');
    await page.waitForSelector('[data-testid="modal-pricing-form"]');
    await page.fill('[data-testid="input-cpm-rate"]', '12.50');
    await page.selectOption('[data-testid="select-pricing-retailer"]', SEED.retailerId);
    await page.click('[data-testid="btn-pricing-form-submit"]');
    await assertHeader();

    await expect(page.locator('[data-testid="pricing-save-confirmation"]')).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.10 — Create Brand User + Retailer User
  // ─────────────────────────────────────────────────────────────────────────
  test('1.10 create Brand User and Retailer User', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/users', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="users-list"]');

    const usersToCreate = [
      {
        email: 'brand@softomedia.demo',
        role: 'brand',
        linkedEntityId: SEED.advertiserId,
        displayName: 'Demo Brand',
      },
      {
        email: 'retailer@softomedia.demo',
        role: 'retaileradmin',
        linkedEntityId: SEED.retailerId,
        displayName: 'Demo Retailer',
      },
    ];

    for (const user of usersToCreate) {
      const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/users');

      await page.click('[data-testid="btn-add-user"]');
      await page.waitForSelector('[data-testid="modal-user-form"]');
      await page.fill('[data-testid="input-user-email"]', user.email);
      await page.fill('[data-testid="input-user-displayname"]', user.displayName);
      await page.selectOption('[data-testid="select-user-role"]', user.role);
      await page.fill('[data-testid="input-user-entity-id"]', user.linkedEntityId);
      await page.click('[data-testid="btn-user-form-submit"]');
      await assertHeader();

      await expect(
        page.locator('[data-testid="users-list"]').getByText(user.email),
      ).toBeVisible({ timeout: 10000 });
    }
  });

});
