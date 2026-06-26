const { test, expect } = require('./base.fixtures');

test.describe('End-to-End Gold Path: Multi-Persona Journey', () => {
    test.beforeEach(async ({ adminPage: page }) => {
        // Mock API endpoints for consistent test behavior
        await page.route('**/api/assets/upload', route => {
            route.fulfill({
                status: 201,
                json: {
                    id: 'mock-asset-001',
                    filename: 'demo-ad.mp4',
                    duration: 5,
                    status: 'ready'
                }
            });
        });
        await page.route('**/api/campaigns', route => {
            if (route.request().method() === 'POST') {
                route.fulfill({
                    status: 201,
                    json: {
                        id: `campaign-${Date.now()}`,
                        title: 'Test Campaign',
                        status: 'active'
                    }
                });
            } else {
                route.continue();
            }
        });
    });

    test.fixme('should allow a seamless journey from Admin to Brand to Retailer', async ({ adminPage: page }) => {
        // 1. Start as Admin - Check Health
        await page.goto('/dashboard/admin');
        await expect(page.getByText(/admin mode/i)).toBeVisible();

        await page.locator('[data-testid="menu-toggle"]').click();
        await page.getByText(/system health/i).click();
        await expect(page.getByText(/system health/i)).toBeVisible();
        // Wait for the indicator to move from 'checking' to 'online'
        await expect(page.locator('[data-testid="health-status"]').getByText(/online/i).first()).toBeVisible({ timeout: 10000 });

        // 2. Switch to Brand - Create Campaign
        await page.locator('[data-testid="persona-brand"]').waitFor({ state: 'visible' });
        await page.locator('[data-testid="persona-brand"]').click();
        await page.waitForURL('**/dashboard/brand**');
        await expect(page.getByText(/brand mode/i)).toBeVisible();
        await page.locator('[data-testid="new-campaign-btn"]').click();
        await expect(page).toHaveURL(/.*campaign\/new/);

        // 3. Switch to Retailer - Check Dashboard
        await page.locator('[data-testid="persona-retailer"]').waitFor({ state: 'visible' });
        await page.locator('[data-testid="persona-retailer"]').click();
        await page.waitForURL('**/dashboard/retailer**');
        await expect(page.getByText(/retailer mode/i)).toBeVisible();
        await expect(page.getByText(/retailer command/i)).toBeVisible();

        // The journey is complete if we can see the Retailer dashboard content
        await expect(page.getByText('Network Connectivity')).toBeVisible();
    });

    test.fixme('Visual Stability: Brand Dashboard', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand');
        // Wait for charts/data to load
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot('brand-dashboard-main.png', {
            maxDiffPixelRatio: 0.1,
            mask: [page.locator('.animate-pulse')] // Mask any loading pulses
        });
    });
});
