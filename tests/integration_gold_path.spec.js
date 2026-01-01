const { test, expect } = require('./base.fixtures');

test.describe('End-to-End Gold Path: Multi-Persona Journey', () => {
    test('should allow a seamless journey from Admin to Brand to Retailer', async ({ page }) => {
        // 1. Start as Admin - Check Health
        await page.goto('/dashboard/admin');
        await expect(page.getByText('ADMIN MODE')).toBeVisible();

        await page.locator('[data-testid="menu-toggle"]').click();
        await page.getByText('System Health').click();
        await expect(page.getByText('System Health')).toBeVisible();
        // Wait for the indicator to move from 'checking' to 'online'
        await expect(page.locator('[data-testid="health-status"]')).toContainText(/online/i, { timeout: 5000 });

        // 2. Switch to Brand - Create Campaign (Partial flow check)
        await page.locator('[data-testid="persona-brand"]').click();
        await page.waitForLoadState('networkidle');
        await expect(page.getByText('BRAND MODE')).toBeVisible();
        await page.getByRole('button', { name: 'New Campaign' }).click();
        await expect(page).toHaveURL(/.*campaign\/new/);

        // 3. Switch to Retailer - Check Dashboard
        await page.locator('[data-testid="persona-retailer"]').click();
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
