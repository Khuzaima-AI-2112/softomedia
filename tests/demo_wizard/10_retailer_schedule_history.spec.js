/**
 * Phase 10 — Retailer Schedule History
 * Persona: DEMO_RETAILER | x-demo-role: retaileradmin
 *
 * FIX [Issue 11]: Assertions target structured data fields only —
 * NOT human-readable display strings (locale/component-dependent).
 *
 * Depends on:
 *   Phase 2 — schedule override (type=override, Sunday 02:00–04:00)
 *   Phase 9 — slot shift (type=slot-shift, +1 hour)
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_RETAILER, BASE_URL } from './demo.fixtures.js';
import { getLocator, RetailerLocators as RL } from './retailer_locators.js';

test.beforeEach(authReset);

test.describe.serial('Phase 10 — Retailer Schedule History', () => {

  test('10.1 — Navigate to Schedule History; table non-empty', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/schedule-history`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(getLocator(page, RL.ScheduleHistory)).toBeVisible();
    // History table must contain at least one row
    const rows = getLocator(page, RL.ScheduleHistoryRow);
    await expect(rows.first()).toBeVisible();
  });

  test('10.2 — Phase 2 override row: structured fields (type, actorId, time range)', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);

    // Read history via API to assert structured fields — not display strings
    const response = await page.request.get(`${BASE_URL}/api/schedules/history?retailerId=demo-freshmart`, {
      headers: {
        'Authorization': 'Bearer demo-token',
        'x-demo-role': 'retaileradmin',
      },
    });
    expect(response.status()).toBe(200);
    const history = await response.json();

    // Find the override row
    const overrideRow = Array.isArray(history)
      ? history.find((r) => r.type === 'override' && r.actorId === 'demo-freshmart')
      : null;
    expect(overrideRow).not.toBeNull();

    // startTime and endTime must fall within Sunday 02:00–04:00 of current week
    const start = new Date(overrideRow.startTime);
    const end = new Date(overrideRow.endTime);
    expect(start.getDay()).toBe(0); // Sunday
    expect(start.getHours()).toBe(2);
    expect(end.getDay()).toBe(0);
    expect(end.getHours()).toBeLessThanOrEqual(4);
  });

  test('10.3 — Phase 9 slot-shift row: previousStartTime and newStartTime differ by 1 hour', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);

    const response = await page.request.get(`${BASE_URL}/api/schedules/history?retailerId=demo-freshmart`, {
      headers: {
        'Authorization': 'Bearer demo-token',
        'x-demo-role': 'retaileradmin',
      },
    });
    expect(response.status()).toBe(200);
    const history = await response.json();

    // Find the most recent slot-shift row
    const shifts = Array.isArray(history)
      ? history.filter((r) => r.type === 'slot-shift' && r.actorId === 'demo-freshmart')
      : [];
    expect(shifts.length).toBeGreaterThan(0);

    const latest = shifts[shifts.length - 1];
    expect(latest.previousStartTime).not.toBeNull();
    expect(latest.newStartTime).not.toBeNull();
    // Difference must be exactly 3600000 ms (1 hour)
    const diff = Math.abs(
      new Date(latest.newStartTime).getTime() - new Date(latest.previousStartTime).getTime()
    );
    expect(diff).toBe(3600000);
  });

});
