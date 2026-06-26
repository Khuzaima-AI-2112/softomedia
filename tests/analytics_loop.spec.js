/**
 * Analytics Loop E2E Tests
 * Tests for Sprint 5: Analytics & Telemetry
 * Verifies proof-of-play dashboard functionality
 */

const { test, expect } = require('./base.fixtures');

const { mockLoopsApi, mockAnalyticsApi } = require('./fixtures/mock-routes.js');

test.describe('Loop Analytics - Sprint 5', () => {
    test.beforeEach(async ({ adminPage }) => {
        await mockLoopsApi(adminPage);
        await mockAnalyticsApi(adminPage);
    });

    test('Admin can navigate to Loop Analytics', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loop-analytics');
        await expect(page.getByRole('heading', { name: 'Loop Analytics' })).toBeVisible();
        await expect(page.getByTestId('avg-integrity-score')).toBeVisible();
    });

    test('Analytics shows summary stats', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loop-analytics');

        // Check for stat cards
        await expect(page.locator('[data-testid="total-loops"]')).toBeVisible();
        await expect(page.locator('[data-testid="avg-integrity-score"]')).toBeVisible();
        await expect(page.locator('[data-testid="full-delivery-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="slot-failures-count"]')).toBeVisible();
    });

    test('Analytics shows hourly chart', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loop-analytics');

        await page.getByRole('button', { name: 'Day', exact: true }).click();
        await expect(page.locator('[data-testid="hourly-chart"]')).toBeVisible();

        // Check for business hours (8am to 9pm)
        await expect(page.locator('[data-testid="analytics-hour-8"]')).toBeVisible();
        await expect(page.locator('[data-testid="analytics-hour-14"]')).toBeVisible();
    });

    test('Admin can click hour to see slot details', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loop-analytics');

        await page.getByRole('button', { name: 'Day', exact: true }).click();

        // Click on 2pm slot
        await page.locator('[data-testid="analytics-hour-14"]').click();

        // Slot details should appear
        await expect(page.locator('[data-testid="slot-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="slot-detail-0"]')).toBeVisible();
    });

    test('Analytics has date picker', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loop-analytics');

        await expect(page.locator('[data-testid="analytics-date-picker"]')).toBeVisible();
    });

    test('Analytics shows delivery rate colors', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loop-analytics');
        await page.getByRole('button', { name: 'Day', exact: true }).click();

        // Legend should be visible
        await expect(page.getByText('>99%')).toBeVisible();
        await expect(page.getByText('95–99%')).toBeVisible();
        await expect(page.getByText('<95%')).toBeVisible();
    });
});
