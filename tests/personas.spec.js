const { test, expect } = require('@playwright/test');

test.describe('Persona Switching & Persistence', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the root, which should redirect to /dashboard
        await page.goto('http://localhost:5173/');
    });

    test('should default to Brand persona', async ({ page }) => {
        // Check if the persona switcher has the Brand button highlighted
        const brandButton = page.getByRole('button', { name: 'Brand' });
        await expect(brandButton).toHaveClass(/bg-primary/);

        // Check header text
        await expect(page.getByText('BRAND MODE')).toBeVisible();
    });

    test('should switch to Admin persona', async ({ page }) => {
        const adminButton = page.getByRole('button', { name: 'Admin' });
        await adminButton.click();

        // Verify highlighting
        await expect(adminButton).toHaveClass(/bg-red-500/);

        // Verify header update
        await expect(page.getByText('ADMIN MODE')).toBeVisible();

        // Check if content changed (Overview is common to Admin)
        await expect(page.locator('main')).toBeVisible();
    });

    test('should switch to Retailer persona', async ({ page }) => {
        const retailerButton = page.getByRole('button', { name: 'Retailer' });
        await retailerButton.click();

        // Verify highlighting
        await expect(retailerButton).toHaveClass(/bg-emerald-500/);

        // Verify header update
        await expect(page.getByText('RETAILER MODE')).toBeVisible();
    });

    test('should persist persona across reloads', async ({ page }) => {
        // Switch to Admin
        await page.getByRole('button', { name: 'Admin' }).click();
        await expect(page.getByText('ADMIN MODE')).toBeVisible();

        // Reload
        await page.reload();

        // Verify still Admin
        await expect(page.getByText('ADMIN MODE')).toBeVisible();
        const adminButton = page.getByRole('button', { name: 'Admin' });
        await expect(adminButton).toHaveClass(/bg-red-500/);
    });
});

test.describe('Brand Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173/dashboard/brand');
    });

    test('should display KPI cards', async ({ page }) => {
        await expect(page.getByText('Total Active')).toBeVisible();
        await expect(page.getByText('Screens Live')).toBeVisible();
        await expect(page.getByText('Daily Impressions')).toBeVisible();
        await expect(page.getByText('12')).toBeVisible();
    });

    test('should display campaign table', async ({ page }) => {
        await expect(page.getByText('Summer Sale Promo 2024')).toBeVisible();
        await expect(page.getByText('Back to School')).toBeVisible();
        await expect(page.getByText('Flash Sale Shoes')).toBeVisible();
    });

    test('should navigate to new campaign wizard', async ({ page }) => {
        const newCampaignButton = page.getByRole('button', { name: 'New Campaign' });
        await newCampaignButton.click();
        await expect(page).toHaveURL(/.*campaign\/new/);
    });
});

test.describe('Brand Campaign Wizard E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173/dashboard/brand/campaign/new');
    });

    test('should complete Step 1: Location & Screen', async ({ page }) => {
        // Select Store
        await page.getByText('Downtown Flagship').click();

        // Select Screen
        await page.getByText('Main Entrance Kiosk A').click();

        // Check footer updates
        await expect(page.getByText('1 Store')).toBeVisible();
        await expect(page.getByText('1 Screens')).toBeVisible();

        // Next Step
        await page.getByRole('button', { name: 'Next Step' }).click();

        // Should be on Step 2
        await expect(page.getByText('Campaign Duration')).toBeVisible();
    });

    test('should complete Step 2: Schedule & Upload', async ({ page }) => {
        // Step 1 first
        await page.getByText('Downtown Flagship').click();
        await page.getByText('Main Entrance Kiosk A').click();
        await page.getByRole('button', { name: 'Next Step' }).click();

        // Select Time Slot
        await page.getByRole('button', { name: '08:00 - 09:00' }).click();

        // Upload File (Mocking by clicking the dropzone since it handles dataTransfer in code)
        // In a real test we'd use setInputFiles, but since we have a custom component:
        await page.getByText('Click or drag file to upload').click();

        // Proceed to Review
        // We'll need to satisfy the disabled condition (creativeFile and selectedSlots)
        // Since my component is mock-heavy, I'll ensure the button is clickable in the test
        const proceedButton = page.getByRole('button', { name: 'Proceed to Review' });
        await expect(proceedButton).toBeVisible();
        await proceedButton.click();

        // Should be on Step 3
        await expect(page.getByText('1-Hour Loop Visualization')).toBeVisible();
    });

    test('should complete Step 3: Review & Confirm', async ({ page }) => {
        // Fast forward to Step 3 (or navigate directly if state allows, but we use wizard state)
        // For brevity in this plan, let's assume we went through steps:
        await page.getByText('Downtown Flagship').click();
        await page.getByText('Main Entrance Kiosk A').click();
        await page.getByRole('button', { name: 'Next Step' }).click();
        await page.getByRole('button', { name: '08:00 - 09:00' }).click();
        await page.getByText('Click or drag file to upload').click();
        await page.getByRole('button', { name: 'Proceed to Review' }).click();

        // Verify visualization and summary
        await expect(page.getByText('Your Ad (6 Slots)')).toBeVisible();
        await expect(page.getByText('$720.00')).last().toBeVisible();

        // Confirm
        await page.getByRole('button', { name: 'Confirm Distribution' }).click();

        // Redirected back to dashboard
        await expect(page).toHaveURL(/.*dashboard\/brand/);
        await expect(page.getByText('Active Campaigns')).toBeVisible();
    });
});
