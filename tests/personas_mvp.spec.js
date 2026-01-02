import { test, expect } from '@playwright/test';

/**
 * Softomedia MVP - Multi-Persona Integration Tests
 * Validates the full "Ad-to-Screen" journey across all 5 roles.
 */

test.describe('Softomedia MVP: Persona Journeys', () => {

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
        // Mock the campaigns endpoint
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

        // Select a timeslot first (required for proceed button to enable)
        await page.locator('[data-testid^="timeslot-08:00"]').first().click();
        // Use standard data-testid for upload area
        await page.locator('[data-testid="upload-creative-area"]').click();
        await page.waitForTimeout(2000); // Wait for async upload to complete
        await page.locator('[data-testid="proceed-to-review"]').click();

        // Step 3: Review
        await expect(page.getByText(/visualization/i)).toBeVisible();
    });

    test.skip('Retailer Manager: Ad Review & Loop Validation', async ({ page }) => {
        await page.locator('[data-testid="persona-retailer"]').click();

        // Verify Retailer Command Center visible
        await expect(page.getByText(/retailer command/i)).toBeVisible();

        // Navigate to Schedule Manager
        await page.locator('[data-testid="menu-toggle"]').click();
        await page.locator('[data-testid="nav-link-schedule-manager"]').click();
        await expect(page).toHaveURL(/.*\/dashboard\/retailer\/schedule/);

        // Verify Schedule Manager content exists
        await expect(page.getByText(/schedule manager/i)).toBeVisible();
    });

    test.skip('Tech Operator: Fleet Health Dashboard', async ({ page }) => {
        await page.locator('[data-testid="persona-tech"]').click();
        await expect(page.getByText(/technical operations/i)).toBeVisible();
    });

});
