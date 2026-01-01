const { test, expect } = require('./base.fixtures');

test.describe('Persona Switching & Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should default to Brand persona', async ({ page }) => {
        const brandButton = page.locator('[data-testid="persona-brand"]');
        await expect(brandButton).toHaveClass(/bg-primary/);
        await expect(page.getByText('BRAND MODE')).toBeVisible();
    });

    test('should switch to Admin persona', async ({ page }) => {
        const adminButton = page.locator('[data-testid="persona-admin"]');
        await adminButton.click();
        await expect(adminButton).toHaveClass(/bg-red-500/);
        await expect(page.getByText('ADMIN MODE')).toBeVisible();
    });

    test('should switch to Retailer persona', async ({ page }) => {
        const retailerButton = page.locator('[data-testid="persona-retailer"]');
        await retailerButton.click();
        await expect(retailerButton).toHaveClass(/bg-emerald-500/);
        await expect(page.getByText('RETAILER MODE')).toBeVisible();
    });

    test('should persist persona across reloads', async ({ page }) => {
        await page.locator('[data-testid="persona-admin"]').click();
        await expect(page.getByText('ADMIN MODE')).toBeVisible();
        await page.reload();
        await expect(page.getByText('ADMIN MODE')).toBeVisible();
        await expect(page.locator('[data-testid="persona-admin"]')).toHaveClass(/bg-red-500/);
    });
});

test.describe('Brand Dashboard', () => {
    test('should display KPI cards', async ({ brandPage: page }) => {
        await expect(page.getByText('Total Active')).toBeVisible();
        await expect(page.getByText('Screens Live')).toBeVisible();
        await expect(page.getByText('Daily Impressions')).toBeVisible();
    });

    test('should display campaign table', async ({ brandPage: page }) => {
        await expect(page.getByText('Summer Sale Promo 2024')).toBeVisible();
    });

    test('should navigate to new campaign wizard', async ({ brandPage: page }) => {
        const newCampaignButton = page.getByRole('button', { name: 'New Campaign' });
        await newCampaignButton.click();
        await expect(page).toHaveURL(/.*campaign\/new/);
    });
});

test.describe('Brand Campaign Wizard E2E', () => {
    test('should complete Step 1: Location & Screen', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand/campaign/new');
        await page.getByText('Downtown Flagship').click();
        await page.getByText('Main Entrance Kiosk A').click();
        await page.getByRole('button', { name: 'Next Step' }).click();
        await expect(page.getByText('Campaign Duration')).toBeVisible();
    });

    test('should complete Step 2: Schedule & Upload', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand/campaign/new');
        await page.getByText('Downtown Flagship').click();
        await page.getByText('Main Entrance Kiosk A').click();
        await page.getByRole('button', { name: 'Next Step' }).click();
        await page.getByRole('button', { name: '08:00 - 09:00' }).click();
        await page.getByText(/Click or drag file to upload/i).click();
        await page.getByRole('button', { name: 'Proceed to Review' }).click();
        await expect(page.getByText('1-Hour Loop Visualization')).toBeVisible();
    });

    test('should complete Step 3: Review & Confirm', async ({ brandPage: page }) => {
        await page.goto('/dashboard/brand/campaign/new');
        await page.getByText('Downtown Flagship').click();
        await page.getByText('Main Entrance Kiosk A').click();
        await page.getByRole('button', { name: 'Next Step' }).click();
        await page.getByRole('button', { name: '08:00 - 09:00' }).click();
        await page.getByText(/Click or drag file to upload/i).click();
        await page.getByRole('button', { name: 'Proceed to Review' }).click();
        await expect(page.getByText('Your Ad (6 Slots)')).toBeVisible();
        await page.getByRole('button', { name: 'Confirm Distribution' }).click();
        await expect(page).toHaveURL(/.*dashboard\/brand/);
        await expect(page.getByText('Active Campaigns')).toBeVisible();
    });
});
