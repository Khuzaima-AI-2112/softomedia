const { test, expect } = require('./base.fixtures');

test.describe('Persona Switching & Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should default to Brand persona', async ({ page }) => {
        const brandButton = page.locator('[data-testid="persona-brand"]');
        await expect(brandButton).toHaveClass(/bg-primary/);
        await expect(page.getByText(/brand mode/i)).toBeVisible();
    });

    test('should switch to Admin persona', async ({ page }) => {
        const adminButton = page.locator('[data-testid="persona-admin"]');
        await adminButton.click();
        await expect(adminButton).toHaveClass(/bg-red-600/);
        await expect(page.getByText(/admin mode/i)).toBeVisible();
    });

    test('should switch to Retailer persona', async ({ page }) => {
        const retailerButton = page.locator('[data-testid="persona-retailer"]');
        await retailerButton.click();
        await expect(retailerButton).toHaveClass(/bg-emerald-500/);
        await expect(page.getByText(/retailer mode/i)).toBeVisible();
    });

    test('should persist persona across reloads', async ({ page }) => {
        await page.locator('[data-testid="persona-admin"]').click();
        await expect(page.getByText(/admin mode/i)).toBeVisible();
        await page.reload();
        await expect(page.getByText(/admin mode/i)).toBeVisible();
        await expect(page.locator('[data-testid="persona-admin"]')).toHaveClass(/bg-red-600/);
    });
});

test.describe('Brand Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Ensure we are on brand page
        await page.goto('/dashboard/brand');
    });

    test('should display KPI cards', async ({ page }) => {
        await expect(page.locator('[data-testid="kpi-card-total-active"]')).toBeVisible();
        await expect(page.locator('[data-testid="kpi-card-screens-live"]')).toBeVisible();
        await expect(page.locator('[data-testid="kpi-card-daily-impressions"]')).toBeVisible();
    });

    test('should display campaign table', async ({ page }) => {
        await expect(page.getByText(/summer sale promo 2024/i)).toBeVisible();
    });

    test('should navigate to new campaign wizard', async ({ page }) => {
        // Use data-test-id for new campaign button
        await page.locator('[data-testid="new-campaign-btn"]').click();
        await expect(page).toHaveURL(/.*campaign\/new/);
    });
});

test.describe('Brand Campaign Wizard E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock the upload endpoint for consistent test behavior
        await page.route('**/api/assets/upload', route => {
            route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'mock-asset-001',
                    filename: 'demo-ad.mp4',
                    duration: 5,
                    status: 'ready'
                })
            });
        });
        // Mock the campaigns endpoint for Step 3 confirmation
        await page.route('**/api/campaigns', route => {
            if (route.request().method() === 'POST') {
                route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: `campaign-${Date.now()}`,
                        title: 'Test Campaign',
                        status: 'active'
                    })
                });
            } else {
                route.continue();
            }
        });
        await page.goto('/dashboard/brand/campaign/new');
    });

    test('should complete Step 1: Location & Screen', async ({ page }) => {
        await page.locator('[data-testid="store-downtown-flagship"]').click();
        await page.locator('[data-testid="screen-main-entrance-kiosk-a"]').click();
        await page.locator('[data-testid="wizard-next-step"]').click();
        await expect(page.getByText(/campaign duration/i)).toBeVisible();
    });

    test('should complete Step 2: Schedule & Upload', async ({ page }) => {
        await page.locator('[data-testid="store-downtown-flagship"]').click();
        await page.locator('[data-testid="screen-main-entrance-kiosk-a"]').click();
        await page.locator('[data-testid="wizard-next-step"]').click();

        // Use regex for time slots as they might have different whitespace
        await page.locator('[data-testid^="timeslot-08:00"]').first().click();
        await page.locator('[data-testid="upload-creative-area"]').click();
        await page.waitForTimeout(1500); // Wait for async upload to complete
        await page.locator('[data-testid="proceed-to-review"]').click();
        await expect(page.getByText(/visualization/i)).toBeVisible();
    });

    test('should complete Step 3: Review & Confirm', async ({ page }) => {
        await page.locator('[data-testid="store-downtown-flagship"]').click();
        await page.locator('[data-testid="screen-main-entrance-kiosk-a"]').click();
        await page.locator('[data-testid="wizard-next-step"]').click();
        await page.locator('[data-testid^="timeslot-08:00"]').first().click();
        await page.locator('[data-testid="upload-creative-area"]').click();
        // Wait for mocked upload response and state update
        await page.waitForTimeout(2000);
        await page.locator('[data-testid="proceed-to-review"]').click();

        // Wait for Step 3 to fully load (match debug test pattern)
        await expect(page.getByText(/visualization/i)).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="confirm-distribution-btn"]').click();
        await expect(page).toHaveURL(/.*dashboard\/brand/);
        await expect(page.getByText(/active campaigns/i)).toBeVisible();
    });
});
