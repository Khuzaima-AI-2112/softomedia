/**
 * Phase 8 - Retailer Campaign Approval Gate
 * Persona: DEMO_RETAILER | x-demo-role: retaileradmin
 *
 * Critical: This is the mandatory brand-safety gate.
 * A campaign submitted in Phase 3 cannot be scheduled until approved here.
 * Completes the loop: Brand submits -> Retailer approves -> Admin validates -> Player broadcasts.
 *
 * Gap 2 negative: Reject path (last step) + afterAll restore to 'approved'.
 * Depends on: massivee2e_consolidated.md Gap 2 - Phase B reject path.
 */

import { test, expect } from '@playwright/test';
import { authReset, loginAs, DEMO_RETAILER, BASE_URL, API_BASE_URL } from './demo.fixtures.js';
import { getLocator, RetailerLocators as RL } from './retailer_locators.js';

test.beforeEach(authReset);

test.describe.serial('Phase 8 - Retailer Campaign Approval Gate', () => {

  test('8.1 - Navigate to Campaign Approvals', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/campaign-approvals`);
    await expect(getLocator(page, RL.CampaignApprovalList)).toBeVisible();
    // BonVie Summer Demo must be in pending queue from Phase 3
    await expect(page.getByText('BonVie Summer Demo')).toBeVisible();
  });

  test('8.2 - Open campaign detail', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/campaign-approvals`);
    // Click the campaign row to expand/navigate to detail
    await page.getByText('BonVie Summer Demo').click();
    // Creative thumbnail and metadata must be visible
    await expect(page.locator('[data-testid="campaign-detail"], [data-testid="campaign-creative-thumbnail"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="campaign-metadata"], [data-testid="campaign-detail"]').first()).toBeVisible();
  });

  test('8.3 - Approve campaign; verify status change and auth header', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/campaign-approvals`);

    // Intercept the approve call and assert the correct role header is sent
    let capturedHeaders = {};
    await page.route('**/api/campaigns/demo-campaign-001/status', async (route) => {
      if (route.request().method() === 'PATCH') {
        capturedHeaders = route.request().headers();
      }
      await route.continue();
    });

    await page.getByText('BonVie Summer Demo').click();
    await getLocator(page, RL.BtnApprove).click();

    // PATCH must return 200
    const response = await page.waitForResponse(
      (res) => res.url().includes('/api/campaigns/demo-campaign-001/status') && res.request().method() === 'PATCH' && res.status() === 200
    );
    expect(response.status()).toBe(200);

    // Role header must be retaileradmin
    expect(capturedHeaders['x-demo-role']).toBe('retaileradmin');

    // Status changes in UI without reload
    await expect(page.locator('[data-testid="campaign-row-demo-campaign-001"] [data-testid="campaign-status"]')).toContainText('approved');
  });

  test('8.4 - Hard-refresh: approval persists, not in pending queue', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/campaign-approvals`);
    await page.reload();
    // After hard-refresh, BonVie Summer Demo must show Approved
    const approvedCampaign = page.locator('[data-testid="campaign-status"]').filter({ hasText: 'Approved' });
    await expect(approvedCampaign).toBeVisible();
    // Must NOT appear in the pending queue section
    const pendingSection = getLocator(page, RL.PendingApprovals);
    if (await pendingSection.isVisible()) {
      await expect(pendingSection).not.toContainText('BonVie Summer Demo');
    }
  });

  // --- Gap 2 Negative: Reject path ---
  // Run LAST - intentionally breaks campaign state; afterAll restores it.
  test('8.NEG - Reject path: campaign status -> Rejected, not in player slot', async ({ page }) => {
    await loginAs(page, DEMO_RETAILER);
    await page.goto(`${BASE_URL}/dashboard/retailer/campaign-approvals`);

    // Intercept the reject call
    const [rejectResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/campaigns/demo-campaign-001/status') && res.request().method() === 'PATCH'
      ),
      page.getByText('BonVie Summer Demo').click().then(() =>
        getLocator(page, RL.BtnReject).click()
      ),
    ]);

    expect(rejectResponse.status()).toBe(200);
    await expect(page.locator('[data-testid="campaign-row-demo-campaign-001"] [data-testid="campaign-status"]')).toContainText('rejected');
  });

});

// Restore demo-campaign-001 to 'approved' before Phase 9 runs
test.afterAll(async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/api/campaigns/demo-campaign-001/status`, {
    headers: {
      'Authorization': 'Bearer demo-token',
      'x-demo-role': 'admin',
    },
    data: { status: 'approved' },
  });
  expect(response.status()).toBe(200);
});
