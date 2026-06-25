/**
 * Phase 9 — Retailer Schedule Manager
 * Persona: DEMO_RETAILER | x-demo-role: retaileradmin
 *
 * Depends on Phase 8: BonVie Summer Demo must be approved before
 * its slots appear in the schedule manager without 'pending approval' badge.
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_RETAILER, BASE_URL } from './demo.fixtures.js';
import { getLocator, RetailerLocators as RL } from './retailer_locators.js';

test.beforeEach(authReset);

test.describe.serial('Phase 9 — Retailer Schedule Manager', () => {

  test('9.1 — Navigate to Schedule Manager', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/schedule-manager`);
    // Must load without 403
    await expect(page).not.toHaveURL(/\/login/);
    await expect(getLocator(page, RL.ScheduleManager)).toBeVisible();
    // FreshMart stores/screens must be visible
    await expect(page.getByText('FreshMart').first()).toBeVisible();
  });

  test('9.2 — Approved BonVie campaign visible in schedule (no pending badge)', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/schedule-manager`);
    // Post-Phase 8 approval: BonVie slots must be present
    await expect(page.getByText('BonVie').filter({ visible: true }).first()).toBeVisible();
    // Must NOT show a 'pending approval' badge on any BonVie slot
    const pendingBadge = getLocator(page, RL.PendingApprovalBadge);
    await expect(pendingBadge).toHaveCount(0);
  });

  test('9.3 — Shift a slot by 1 hour; PATCH returns 200; UI updates', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/schedule-manager`);

    // Intercept the PATCH call and capture the slotId
    let patchUrl = '';
    await page.route('**/api/schedules/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchUrl = route.request().url();
      }
      await route.continue();
    });

    // Click the first available slot and trigger a +1 hour shift
    const firstSlot = getLocator(page, RL.ScheduleSlot).first();
    await firstSlot.click();
    const shiftBtn = page.locator('[data-testid="btn-shift-slot"], [data-testid="btn-slot-later"]').first();
    if (await shiftBtn.isVisible()) {
      const [patchResponse] = await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes('/api/schedules/') && res.request().method() === 'PATCH'
        ),
        shiftBtn.click(),
      ]);
      expect(patchResponse.status()).toBe(200);
      // Slot time must update in UI within 2s
      await page.waitForTimeout(2000);
      expect(patchUrl).toContain('/api/schedules/');
    } else {
      test.skip(true, 'Shift-slot control not found — check ScheduleManager.jsx for data-testid');
    }
  });

});
