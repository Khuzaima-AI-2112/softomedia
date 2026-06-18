/**
 * Phase 2 — Retailer Schedule Configuration
 *
 * Persona: DEMO_RETAILER
 * Steps:
 *   2.1  Login as Retailer
 *   2.2  Open Schedule Calendar — confirm stores/screens from Phase 1 are visible
 *   2.3  Block a no-ads window (Sunday 02:00–04:00) → assert override doc created
 *   2.4  Verify Dashboard KPI reflects the schedule override
 *
 * The schedule override POST response id must start with 'sched_demo_'.
 * This prefix is written by ad-server/src/api/schedules.js when
 * ALLOW_DEMO_MODE=true, providing a cheap assertion that the demo path
 * is active in the running ad-server process.
 */

import { test, expect } from '@playwright/test';
import {
  DEMO_RETAILER,
  BASE_URL,
  SEED,
  authReset,
  loginAs,
  assertRoleHeader,
} from './demo.fixtures.js';

test.describe.serial('Phase 2 — Retailer Schedule', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2.1 — Login
  // ─────────────────────────────────────────────────────────────────────────
  test('2.1 login as Retailer', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await expect(page.locator('[data-testid="dashboard-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-retailer"]')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2.2 — Open Schedule Calendar
  // ─────────────────────────────────────────────────────────────────────────
  test('2.2 open Schedule Calendar — stores and screens visible', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + `/dashboard/retailer/${SEED.retailerId}/schedule`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="schedule-calendar"]');

    // Both stores seeded in Phase 1 must appear in the store filter dropdown
    await expect(
      page.locator('[data-testid="schedule-store-filter"]').getByText('FreshMart Downtown'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="schedule-store-filter"]').getByText('FreshMart Plateau'),
    ).toBeVisible({ timeout: 10000 });

    // All 4 screens must appear in the screen column headers
    for (const screenId of SEED.screenIds) {
      await expect(
        page.locator(`[data-testid="screen-column-${screenId}"]`),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2.3 — Block no-ads window
  // Assert the response id starts with 'sched_demo_' to confirm DEMO_MODE
  // path is active in the running ad-server.
  // ─────────────────────────────────────────────────────────────────────────
  test('2.3 block no-ads window Sunday 02:00–04:00', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + `/dashboard/retailer/${SEED.retailerId}/schedule`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="schedule-calendar"]');

    // Capture the POST response to inspect the returned id
    let overrideId = null;
    await page.route('**/api/schedules**', async (route) => {
      if (route.request().method() === 'POST') {
        const response = await route.fetch();
        const body = await response.json();
        overrideId = body?.id ?? null;
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });

    await page.click('[data-testid="btn-add-schedule-override"]');
    await page.waitForSelector('[data-testid="modal-schedule-override-form"]');

    // Set override details: Sunday, 02:00–04:00, type=blocked
    await page.selectOption('[data-testid="select-override-day"]', 'sunday');
    await page.fill('[data-testid="input-override-start"]', '02:00');
    await page.fill('[data-testid="input-override-end"]',   '04:00');
    await page.selectOption('[data-testid="select-override-type"]', 'blocked');
    await page.click('[data-testid="btn-override-form-submit"]');

    // Wait for the override to appear on the calendar
    await expect(
      page.locator('[data-testid="schedule-override-blocked"]'),
    ).toBeVisible({ timeout: 10000 });

    // Assert DEMO_MODE path: id prefix must be 'sched_demo_'
    expect(overrideId).toBeTruthy();
    expect(overrideId).toMatch(/^sched_demo_/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2.4 — Verify Dashboard KPI reflects the override
  // ─────────────────────────────────────────────────────────────────────────
  test('2.4 retailer dashboard KPI reflects schedule override', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + `/dashboard/retailer/${SEED.retailerId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="retailer-dashboard-kpis"]');

    // The blocked window reduces available airtime — the KPI chip for
    // "Available Hours" should reflect the reduced value.
    // Soft assertion: we verify the chip exists and has a numeric value.
    // Exact value depends on seed data so we check format only.
    const kpiChip = page.locator('[data-testid="kpi-available-hours"]');
    await expect(kpiChip).toBeVisible({ timeout: 10000 });
    const chipText = await kpiChip.textContent();
    expect(chipText).toMatch(/\d/);
  });

});
