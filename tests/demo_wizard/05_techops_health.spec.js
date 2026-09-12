/**
 * Phase 5 — TechOps Health Check
 *
 * Persona: DEMO_TECHOP
 * Steps:
 *   5.1  Login as TechOperator
 *   5.2  Navigate to Health Check dashboard — real dependency states render
 *   5.3  Confirm Screen connectivity and schedule are separate
 */

import { test, expect } from '@playwright/test';
import {
  DEMO_TECHOP,
  BASE_URL,
  authReset,
  loginAs,
} from './demo.fixtures.js';

import { AdminLocators as AL, getLocator } from './admin_locators.js';

test.describe.serial('Phase 5 — TechOps Health Check', () => {

  test.beforeEach(async ({ page }) => {
    await authReset({ page });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5.1 — Login
  // ─────────────────────────────────────────────────────────────────────────
  test('5.1 login as TechOperator', async ({ page }) => {
    await loginAs(page, DEMO_TECHOP);
    await expect(getLocator(page, AL.Shell)).toBeVisible();
    await expect(getLocator(page, AL.NavTechOp)).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5.2 — Health dashboard: connectivity chip renders green
  // ─────────────────────────────────────────────────────────────────────────
  test('5.2 health dashboard — real dependency checks render truthfully', async ({ page }) => {
    await loginAs(page, DEMO_TECHOP);
    await page.goto(
      BASE_URL + '/dashboard/techoperator/health',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="health-dashboard"]');

    await expect(
      page.locator('[data-testid="health-chip-firestore"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="health-chip-firestore"]'),
    ).toHaveAttribute('data-status', /healthy|unavailable/);

    await expect(
      page.locator('[data-testid="health-chip-adserver"]'),
    ).toHaveAttribute('data-status', 'healthy');

    await expect(
      page.locator('[data-testid="health-status-banner"]'),
    ).not.toContainText(/checking/i);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5.3 — Screen connectivity and schedule are separate
  // ─────────────────────────────────────────────────────────────────────────
  test('5.3 screen connectivity is displayed separately from schedule', async ({ page }) => {
    await loginAs(page, DEMO_TECHOP);
    await page.goto(
      BASE_URL + '/dashboard/techoperator/health',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForSelector('[data-testid="health-dashboard"]');

    await expect(page.getByRole('table', { name: 'Screen health' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Connectivity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Approved schedule' })).toBeVisible();
  });

});
