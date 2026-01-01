const { test, expect } = require('./base.fixtures');

test.describe('End-to-End Gold Path: Multi-Persona Journey', () => {
    test('should allow a seamless journey from Admin to Brand to Retailer', async ({ page }) => {
        // 1. Start as Admin - Check Health
        await page.goto('/dashboard/admin');
        await expect(page.getByText('ADMIN MODE')).toBeVisible();

        await page.locator('[data-testid="menu-toggle"]').click();
        await page.getByText('System Health').click();
        await expect(page.getByText('System Health')).toBeVisible();
        // Wait for the indicator to move from 'checking' to 'online' (H1: increased timeout, refined selector)
        await expect(page.locator('[data-testid="health-status"]').getByText(/online/i).first()).toBeVisible({ timeout: 10000 });

        // 2. Switch to Brand - Create Campaign (Partial flow check)
        // H2: Ensure header persona button is visible before clicking
        await page.locator('[data-testid="persona-brand"]').waitFor({ state: 'visible' });
        await page.locator('[data-testid="persona-brand"]').click();
        await page.waitForURL('**/dashboard/brand**');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText('BRAND MODE')).toBeVisible();
        await page.locator('[data-testid="new-campaign-btn"]').click();
        await expect(page).toHaveURL(/.*campaign\/new/);

        // 3. Switch to Retailer - Check Dashboard
        // H2: Ensure header persona button is visible before clicking
        await page.locator('[data-testid="persona-retailer"]').waitFor({ state: 'visible' });
        await page.locator('[data-testid="persona-retailer"]').click();
        // H4: Use glob pattern for more reliable URL matching
        await page.waitForURL('**/dashboard/retailer**');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText('RETAILER MODE')).toBeVisible();
        await expect(page.getByText('Retailer Command')).toBeVisible();

        // The journey is complete if we can see the Retailer dashboard content
        await expect(page.getByText('Network Connectivity')).toBeVisible();
    });

    test('Visual Stability: Brand Dashboard', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand');
        // Wait for charts/data to load
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot('brand-dashboard-main.png', {
            maxDiffPixelRatio: 0.1,
            mask: [page.locator('.animate-pulse')] // Mask any loading pulses
        });
    });
});
