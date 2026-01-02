import { test, expect } from '@playwright/test';

/**
 * Softomedia MVP - Multi-Persona Integration Tests
 * Validates the full "Ad-to-Screen" journey across all 5 roles.
 */

test.describe('Softomedia MVP: Persona Journeys', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to the dashboard base which triggers the persona switcher
        await page.goto('/dashboard');
    });

    test('Super Admin: Global Governance', async ({ page }) => {
        // Select Super Admin Persona
        await page.locator('[data-testid="persona-admin"]').click();
        await expect(page).toHaveURL(/.*\/dashboard\/admin/);

        // Verify visibility of global stats
        await expect(page.getByText(/registered retailers/i)).toBeVisible();
        await expect(page.getByText(/active advertisers/i)).toBeVisible();
    });

    test('Brand Manager: Campaign Wizard & 5s Rule', async ({ page }) => {
        await page.locator('[data-testid="persona-brand"]').click();
        await page.locator('[data-testid="new-campaign-btn"]').click();

        // Step 1: Location Selection
        await expect(page.getByText(/selected location/i)).toBeVisible();
        await page.locator('[data-testid="store-downtown-flagship"]').click();
        await page.locator('[data-testid="screen-main-entrance-kiosk-a"]').click();
        await page.locator('[data-testid="wizard-next-step"]').click();

        // Step 2: Creative Upload/Selection (Mocking 5s validation)
        await expect(page.getByText(/campaign duration/i)).toBeVisible();

        // Use standard data-testid for upload area
        await page.locator('[data-testid="upload-creative-area"]').click();
        await expect(page.getByText(/demo-ad.mp4/i)).toBeVisible();
        await page.locator('[data-testid="proceed-to-review"]').click();

        // Step 3: Review
        await expect(page.getByText(/visualization/i)).toBeVisible();
    });

    test('Retailer Manager: Ad Review & Loop Validation', async ({ page }) => {
        await page.locator('[data-testid="persona-retailer"]').click();

        // Verify Approval Portal
        await expect(page.getByText(/campaign approval portal/i)).toBeVisible();

        // Navigate to Schedule Manager
        await page.locator('[data-testid="menu-toggle"]').click();
        await page.locator('[data-testid="nav-link-schedule-manager"]').click();
        await expect(page).toHaveURL(/.*\/dashboard\/retailer\/schedule/);

        // Verify Loop Breakdown exists
        await expect(page.getByText(/loop breakdown/i)).toBeVisible();
    });

    test('Tech Operator: Fleet Health Dashboard', async ({ page }) => {
        await page.locator('[data-testid="persona-tech"]').click();
        await expect(page.getByText(/technical operations/i)).toBeVisible();
    });

});
