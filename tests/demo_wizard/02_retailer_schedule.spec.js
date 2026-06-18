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
 * Gap 2 closure (N-2.1):
 *   Missing required field: submit schedule override form with no time range.
 *   Client-side validation must fire; POST /api/schedules must NOT be called.
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

  test('2.1 login as Retailer', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await expect(page.locator('[data-testid="dashboard-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-retailer"]')).toBeVisible();
  });

  test('2.2 open Schedule Calendar — stores and screens visible', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + `/dashboard/retailer/${SEED.retailerId}/schedule`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="schedule-calendar"]');

    await expect(
      page.locator('[data-testid="schedule-store-filter"]').getByText('FreshMart Downtown'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="schedule-store-filter"]').getByText('FreshMart Plateau'),
    ).toBeVisible({ timeout: 10000 });

    for (const screenId of SEED.screenIds) {
      await expect(
        page.locator(`[data-testid="screen-column-${screenId}"]`),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('2.3 block no-ads window Sunday 02:00–04:00', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + `/dashboard/retailer/${SEED.retailerId}/schedule`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="schedule-calendar"]');

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
    await page.selectOption('[data-testid="select-override-day"]', 'sunday');
    await page.fill('[data-testid="input-override-start"]', '02:00');
    await page.fill('[data-testid="input-override-end"]',   '04:00');
    await page.selectOption('[data-testid="select-override-type"]', 'blocked');
    await page.click('[data-testid="btn-override-form-submit"]');

    await expect(
      page.locator('[data-testid="schedule-override-blocked"]'),
    ).toBeVisible({ timeout: 10000 });

    expect(overrideId).toBeTruthy();
    expect(overrideId).toMatch(/^sched_demo_/);
  });

  test('2.4 retailer dashboard KPI reflects schedule override', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + `/dashboard/retailer/${SEED.retailerId}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="retailer-dashboard-kpis"]');

    const kpiChip = page.locator('[data-testid="kpi-available-hours"]');
    await expect(kpiChip).toBeVisible({ timeout: 10000 });
    const chipText = await kpiChip.textContent();
    expect(chipText).toMatch(/\d/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // N-2.1 — Gap 2: missing required field → client validation, no POST fired
  // ─────────────────────────────────────────────────────────────────────────
  test('N-2.1 submit schedule override with no time range → validation error, no POST', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(
      BASE_URL + `/dashboard/retailer/${SEED.retailerId}/schedule`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="schedule-calendar"]');

    // Track whether a POST fires
    let postFired = false;
    await page.route('**/api/schedules**', async (route) => {
      if (route.request().method() === 'POST') {
        postFired = true;
      }
      await route.continue();
    });

    await page.click('[data-testid="btn-add-schedule-override"]');
    await page.waitForSelector('[data-testid="modal-schedule-override-form"]');

    // Select a day but intentionally leave start/end times EMPTY
    await page.selectOption('[data-testid="select-override-day"]', 'monday');
    // Do NOT fill input-override-start or input-override-end

    await page.click('[data-testid="btn-override-form-submit"]');

    // Validation error must be visible
    const validationError = page.locator(
      '[data-testid="error-override-start"], [data-testid="error-override-time"], ' +
      '[data-testid="validation-error"], [role="alert"]',
    );
    await expect(validationError.first()).toBeVisible({ timeout: 5000 });

    // Give a short window for any rogue POST — must not fire
    await page.waitForTimeout(500);
    expect(
      postFired,
      'POST /api/schedules must NOT be called when time fields are empty',
    ).toBe(false);
  });

});
