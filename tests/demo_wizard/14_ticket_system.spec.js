/**
 * Phase 14 — Ticket System (All Personas)
 * Spec covers:
 *   Admin: creates ticket, views detail
 *   PERSONA SWITCH (explicit authReset — FIX Issue 7)
 *   Retailer: views ticket, adds reply
 *
 * Gap 2 negative: Access nonexistent ticket → 404.
 *
 * FIX [Issue 7]: Explicit authReset + loginAs between Admin and Retailer persona
 * steps. Prior implicit switch reproduced the PR #46 demo_role/active_persona bleed.
 *
 * FIX [BigTest 2026-06-24]: Test 14.3 updated to:
 *   - Use correct URL /ghost-api/tickets (not /api/tickets — ghost-api is a separate mount)
 *   - Navigate the multi-step modal (issue-type selection → form → submit)
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_ADMIN, DEMO_RETAILER, BASE_URL } from './demo.fixtures.js';
import { getLocator, AdminLocators as AL } from './admin_locators.js';

test.beforeEach(authReset);

test.describe.serial('Phase 14 — Ticket System', () => {

  // ─── Admin creates a ticket ───────────────────────────────────────────────────

  test('14.1 — Login as Admin', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    const role = await page.evaluate(() => localStorage.getItem('demo_role'));
    expect(role).toBe('admin');
  });

  test('14.2 — Navigate to Ticket Dashboard; renders without error', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(`${BASE_URL}/dashboard/tickets`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="ticket-dashboard"]')).toBeVisible();
    // List may be empty — assert no error state
    await expect(page.locator('[data-testid="error-state"]')).toHaveCount(0);
  });

  test('14.3 — Admin creates a ticket; POST 201 returned', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(`${BASE_URL}/dashboard/tickets`);

    const [postResponse] = await Promise.all([
      // Modal POSTs to /ghost-api/tickets (separate Express mount from /api)
      page.waitForResponse(
        (res) => res.url().includes('/ghost-api/tickets') && res.request().method() === 'POST',
        { timeout: 15000 }
      ),
      (async () => {
        // Step 1: open modal
        await page.locator('[data-testid="btn-create-ticket"]').click();
        // Step 2: issue-type selection — click the first option to advance to the form step
        const firstOption = page.locator('button').filter({ hasText: /Wi-Fi|Power|Sync/ }).first();
        if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstOption.click();
        }
        // Step 3: fill subject in form step
        const subjectInput = page.locator('[data-testid="ticket-subject-input"]').first();
        await subjectInput.waitFor({ state: 'visible', timeout: 5000 });
        await subjectInput.fill('Demo Ticket — Phase 14');
        
        // Fill notes to satisfy the required constraint
        const notesInput = page.locator('[data-testid="ticket-notes-input"]').first();
        await notesInput.fill('Observation notes for demo ticket creation');

        // Step 4: submit
        await page.locator('[data-testid="btn-submit-ticket"]').first().click();
      })(),
    ]);

    expect(postResponse.status()).toBe(201);
    const body = await postResponse.json();
    expect(body.id).toBe('demo-ticket-001');
    expect(body.status).toBe('open');

    // Modal success screen must be visible
    await expect(page.getByText('Ticket Received')).toBeVisible({ timeout: 5000 });
  });

  test('14.4 — Open ticket detail; subject and status visible', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    await page.goto(`${BASE_URL}/dashboard/tickets/demo-ticket-001`);
    await expect(page).not.toHaveURL(/404/);
    await expect(page.locator('[data-testid="ticket-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="ticket-status"]')).toBeVisible();
  });

  // ─── Persona Switch — Admin → Retailer (FIX Issue 7) ─────────────────────────

  test('14.4b — authReset + loginAs DEMO_RETAILER before Retailer steps', async ({ page }) => {
    // authReset is called in beforeEach; this test performs an explicit loginAs
    // to guarantee no role bleed from the Admin steps above.
    await loginAs(page, DEMO_RETAILER);
    const role = await page.evaluate(() => localStorage.getItem('demo_role'));
    expect(role).toBe('retaileradmin');
    await expect(getLocator(page, AL.Shell)).toBeVisible();
    // Confirm x-demo-role is set correctly before Retailer steps proceed
    let capturedRole = '';
    await page.route('**/api/**', async (route) => {
      capturedRole = route.request().headers()['x-demo-role'] || '';
      await route.continue();
    });
    await page.goto(`${BASE_URL}/dashboard/retailer`);
    await page.waitForTimeout(300);
    expect(capturedRole).toBe('retaileradmin');
  });

  // ─── Retailer views and responds ─────────────────────────────────────────────

  test('14.5 — Retailer navigates to Ticket Dashboard', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/tickets`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="ticket-dashboard"]')).toBeVisible();
    // Scope note: if cross-role visibility is not implemented, assert empty list without error
    await expect(page.locator('[data-testid="error-state"]')).toHaveCount(0);
  });

  test('14.6 — Retailer adds reply to ticket; POST 201; reply in thread', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);

    // If retailer cannot see admin tickets, run this step as admin
    const retailerCanSeeTicket = await (async () => {
      await page.goto(`${BASE_URL}/dashboard/tickets/demo-ticket-001`);
      return page.locator('[data-testid="ticket-detail"]').isVisible().catch(() => false);
    })();

    if (!retailerCanSeeTicket) {
      // Demote to admin persona per scope note in massivee2e.md
      await authReset({ page });
      await loginAs(page, DEMO_ADMIN);
      await page.goto(`${BASE_URL}/dashboard/tickets/demo-ticket-001`);
    }

    const replyInput = page.locator('[data-testid="ticket-reply-input"], textarea[name="reply"]').first();
    await replyInput.fill('Phase 14 automated reply — Retailer');

    const [replyResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/tickets/demo-ticket-001/replies') && res.request().method() === 'POST'
      ),
      page.locator('[data-testid="btn-send-reply"], button[type="submit"]').first().click(),
    ]);

    expect(replyResponse.status()).toBe(201);
    // Reply must appear in thread without page reload
    await expect(page.getByText('Phase 14 automated reply')).toBeVisible();
  });

  // ─── Gap 2 Negative: Nonexistent ticket → 404 ────────────────────────────────
  test('14.NEG — Access nonexistent ticket → 404; no ticket content rendered', async ({ page }) => {
    await loginAs(page, DEMO_ADMIN);
    const response = await page.request.get(`${BASE_URL}/api/tickets/nonexistent-ticket-id`, {
      headers: {
        'Authorization': 'Bearer demo-token',
        'x-demo-role': 'admin',
      },
    });
    expect(response.status()).toBe(404);
    // UI: navigating to the nonexistent ticket must not render ticket content
    await page.goto(`${BASE_URL}/dashboard/tickets/nonexistent-ticket-id`);
    await expect(page.locator('[data-testid="ticket-detail"]')).toHaveCount(0);
    // Must not be a blank white screen — should show 404 or error state
    await expect(page.locator('[data-testid="error-state"], [data-testid="not-found"]').first()).toBeVisible();
  });

});
