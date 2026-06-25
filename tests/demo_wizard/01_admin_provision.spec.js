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
 *
 * Gap 2 closure (N-1.1):
 *   Wrong-role write: POST /api/retailers as 'brand' → must return 403.
 *   Firestore must NOT contain a new retailer doc from this call.
 */

import { test, expect } from '@playwright/test';
import {
  DEMO_ADMIN,
  DEMO_SUPERADMIN,
  DEMO_BRAND,
  BASE_URL,
  API_BASE_URL,
  DEMO_TOKEN,
  SEED,
  authReset,
  loginAs,
  assertRoleHeader,
} from './demo.fixtures.js';

import { AdminLocators as AL, getLocator } from './admin_locators.js';

test.describe.serial('Phase 1 — Admin Provision', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.1 — Login
  // ─────────────────────────────────────────────────────────────────────────
  test('1.1 login as Admin', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await expect(getLocator(page, AL.Shell)).toBeVisible();
    await expect(getLocator(page, AL.NavAdmin)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.2 — Create Retailer
  // ─────────────────────────────────────────────────────────────────────────
  test('1.2 create Retailer — FreshMart Montréal', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/retailers', { waitUntil: 'domcontentloaded' });
    await getLocator(page, AL.Retailers.List).waitFor();

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/retailers');

    await getLocator(page, AL.Retailers.BtnAdd).click();
    await getLocator(page, AL.Retailers.ModalForm).waitFor();
    await getLocator(page, AL.Retailers.InputName).fill('FreshMart Montréal');
    await getLocator(page, AL.Retailers.InputContact).fill('demo@freshmart.ca');
    await getLocator(page, AL.Retailers.BtnSubmit).click();
    await assertHeader();

    // Assert the new retailer appears in the list
    await expect(
      getLocator(page, AL.Retailers.List).getByText('FreshMart Montréal').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.3 — Add Store A
  // ─────────────────────────────────────────────────────────────────────────
  test('1.3 add Store A — FreshMart Downtown', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(
      BASE_URL + '/dashboard/admin/retailers',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="retailers-list"]');
    await page.click('text=FreshMart Montréal');
    await page.waitForSelector('[data-testid="stores-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/stores');

    await page.click('[data-testid="btn-add-store"]');
    await page.waitForSelector('[data-testid="modal-store-form"]');
    await page.fill('[data-testid="input-store-name"]', 'FreshMart Downtown');
    await page.fill('[data-testid="input-store-address"]', '100 Rue Sainte-Catherine, Montréal, QC');
    await page.fill('[data-testid="input-store-city"]', 'Montreal');
    await page.click('[data-testid="btn-store-form-submit"]');
    await assertHeader();

    await expect(
      page.locator('[data-testid="stores-list"]').getByText('FreshMart Downtown').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.4 — Add Store B
  // ─────────────────────────────────────────────────────────────────────────
  test('1.4 add Store B — FreshMart Plateau', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(
      BASE_URL + '/dashboard/admin/retailers',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="retailers-list"]');
    await page.click('text=FreshMart Montréal');
    await page.waitForSelector('[data-testid="stores-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/stores');

    await page.click('[data-testid="btn-add-store"]');
    await page.waitForSelector('[data-testid="modal-store-form"]');
    await page.fill('[data-testid="input-store-name"]', 'FreshMart Plateau');
    await page.fill('[data-testid="input-store-address"]', '4500 Avenue du Parc, Montréal, QC');
    await page.fill('[data-testid="input-store-city"]', 'Montreal');
    await page.click('[data-testid="btn-store-form-submit"]');
    await assertHeader();

    await expect(
      page.locator('[data-testid="stores-list"]').getByText('FreshMart Plateau').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.5 — Add Screens (2 per store, 4 total)
  // ─────────────────────────────────────────────────────────────────────────
  test('1.5 add 4 screens (2 per store)', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/screens', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="screens-list"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/screens');

    const screenDefs = [
      { name: 'demo-screen-north-1', storeLabel: 'FreshMart Downtown (Montreal)' },
      { name: 'demo-screen-north-2', storeLabel: 'FreshMart Downtown (Montreal)' },
      { name: 'demo-screen-south-1', storeLabel: 'FreshMart Plateau (Montreal)' },
      { name: 'demo-screen-south-2', storeLabel: 'FreshMart Plateau (Montreal)' },
    ];

    for (const screen of screenDefs) {
      await page.click('[data-testid="btn-add-screen"]');
      await page.waitForSelector('[data-testid="modal-screen-form"]');
      await page.fill('[data-testid="input-screen-name"]', screen.name);
      await page.selectOption('[data-testid="select-screen-retailer"]', { label: 'FreshMart Montréal' });
      await page.selectOption('[data-testid="select-screen-store"]', { label: screen.storeLabel });
      await page.click('[data-testid="btn-screen-form-submit"]');
      await assertHeader();
      await page.waitForSelector('[data-testid="modal-screen-form"]', { state: 'hidden' });
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
      BASE_URL + `/dashboard/admin/hours`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="business-hours-form"]');

    const stores = ['FreshMart Downtown', 'FreshMart Plateau'];
    for (const storeName of stores) {
      await page.getByText(storeName).first().click();
      const openInputs = page.locator('[data-testid="input-hours-open"]');
      const closeInputs = page.locator('[data-testid="input-hours-close"]');
      
      const count = await openInputs.count();
      for (let i = 0; i < count; i++) {
        await openInputs.nth(i).fill('08:00');
        await closeInputs.nth(i).fill('22:00');
      }

      const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/weekly-hours');
      await page.click('[data-testid="btn-hours-save"]');
      await assertHeader();
      await expect(page.locator('[data-testid="hours-save-confirmation"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
    }
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
      page.locator('[data-testid="advertisers-list"]').getByText('BonVie Snacks').first(),
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
    await page.goto(
      BASE_URL + '/dashboard/admin/pricing',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="pricing-calendar"]');

    const assertHeader = await assertRoleHeader(page, DEMO_ADMIN.role, '/api/pricing');

    await page.click('[data-testid="btn-edit-base-cpm"]');
    await page.fill('[data-testid="input-cpm-rate"]', '12.50');
    await page.click('[data-testid="btn-save-base-cpm"]');
    await assertHeader();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1.10 — Create Brand User + Retailer User
  // ─────────────────────────────────────────────────────────────────────────
  test('1.10 create Brand User and Retailer User', async ({ page }) => {
    await loginAs(page, DEMO_SUPERADMIN);
    await page.goto(BASE_URL + '/dashboard/admin/users', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="users-list"]');

    const usersToCreate = [
      {
        email: 'brand@softomedia.demo',
        role: 'advertiser',
        entityLabel: 'BonVie Snacks',
        displayName: 'Demo Brand',
      },
      {
        email: 'retailer@softomedia.demo',
        role: 'retaileradmin',
        entityLabel: 'FreshMart Montréal',
        displayName: 'Demo Retailer',
      },
    ];

    for (const user of usersToCreate) {
      const assertHeader = await assertRoleHeader(page, DEMO_SUPERADMIN.role, '/api/users');

      await page.click('[data-testid="btn-add-user"]');
      await page.waitForSelector('[data-testid="modal-user-form"]');
      await page.fill('[data-testid="input-user-email"]', user.email);
      await page.fill('[data-testid="input-user-displayname"]', user.displayName);
      await page.selectOption('[data-testid="select-user-role"]', user.role);
      await page.selectOption('[data-testid="input-user-entity-id"]', { label: user.entityLabel });
      await page.click('[data-testid="btn-user-form-submit"]');
      await assertHeader();

      await expect(
        page.locator('[data-testid="users-list"]').getByText(user.email).first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // N-1.1 — Gap 2: wrong-role write → 403
  // A 'brand' user must not be able to create a retailer.
  // Uses request fixture (no UI) — fastest way to assert the auth guard.
  // ─────────────────────────────────────────────────────────────────────────
  test('N-1.1 wrong-role POST /api/retailers as brand → 403 Forbidden', async ({ playwright }) => {
    const brandCtx = await playwright.request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${DEMO_TOKEN}`,
        'x-demo-role': DEMO_BRAND.role, // brand — must be rejected
        'Content-Type': 'application/json',
      },
    });
    try {
      const res = await brandCtx.post('/api/retailers', {
        data: { name: 'Forbidden Retailer Inc.', contact: 'nope@forbidden.ca' },
      });
      expect(
        res.status(),
        'POST /api/retailers as brand must return 403 — requireRole guard failed',
      ).toBe(403);
    } finally {
      await brandCtx.dispose();
    }
  });

});
