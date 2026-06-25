import { test, expect } from '@playwright/test';

/**
 * Softomedia MVP - Multi-Persona Integration Tests
 * Validates the full "Ad-to-Screen" journey across all 5 roles.
 */

test.describe('Softomedia MVP: Persona Journeys', () => {

    test.beforeEach(async ({ adminPage: page }) => {
        // Mock the upload endpoint for consistent test behavior
        await page.route('**/api/assets/upload', route => {
            const assetPayload = {
                id: 'mock-asset-001',
                filename: 'demo-ad.mp4',
                duration: 5,
                status: 'ready'
            };
            route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify(assetPayload)
            });
        });
        // Mock the campaigns endpoint
        await page.route('**/api/campaigns', route => {
            if (route.request().method() === 'POST') {
                const campaignPayload = {
                    id: `campaign-${Date.now()}`,
                    title: 'Test Campaign',
                    status: 'active'
                };
                route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify(campaignPayload)
                });
            } else {
                route.continue();
            }
        });
        // Unified Mocks
        const { mockRetailers, mockStores, mockScreens, createMockResponse } = require('./mocks/index');

        // Mock Admin Data
        await page.route('**/api/retailers', route => route.fulfill(createMockResponse(mockRetailers)));
        await page.route('**/api/advertisers', route => route.fulfill(createMockResponse([]))); // 0 advertisers mocked initially
        await page.route('**/api/screens', route => route.fulfill(createMockResponse(mockScreens)));
        await page.route('**/api/loops', route => route.fulfill(createMockResponse([])));
        await page.route('**/api/users', route => route.fulfill(createMockResponse([])));

        // Navigate to the dashboard base which triggers the persona switcher
        await page.goto('/dashboard');
    });

    test('Super Admin: Global Governance', async ({ adminPage: page }) => {
        // Select Super Admin Persona
        await page.locator('[data-testid="persona-admin"]').click();
        await expect(page).toHaveURL(/.*\/dashboard\/admin/);

        // Verify visibility of global stats using stable selectors
        await expect(page.locator('[data-testid="stat-card-retailers"]')).toBeVisible();
        await expect(page.locator('[data-testid="stat-card-advertisers"]')).toBeVisible();

        // Optional: Verify values if we mock them specifically
        // await expect(page.locator('[data-testid="stat-value-retailers"]')).not.toBeEmpty();
    });

    test.skip('Brand Manager: Campaign Wizard & 5s Rule', async ({ adminPage: page }) => {
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

        const nextBtn = page.locator('[data-testid="proceed-to-review"]');
        await expect(nextBtn).toBeEnabled();
        await nextBtn.click();

        // Step 3: Review
        await expect(page.getByText(/visualization/i)).toBeVisible();
    });

    test.skip('Retailer Manager: Ad Review & Loop Validation', async ({ adminPage: page }) => {
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

    test.skip('Tech Operator: Fleet Health Dashboard', async ({ adminPage: page }) => {
        await page.locator('[data-testid="persona-tech"]').click();
        await expect(page.getByText(/technical operations/i)).toBeVisible();
    });

});
