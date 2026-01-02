/**
 * Analytics Loop E2E Tests
 * Tests for Sprint 5: Analytics & Telemetry
 * Verifies proof-of-play dashboard functionality
 */

const { test, expect } = require('./base.fixtures');

test.describe('Loop Analytics - Sprint 5', () => {
    test.beforeEach(async ({ page }) => {
        // Mock loops endpoint for analytics
        await page.route('**/api/loops**', route => {
            const date = new Date().toISOString().split('T')[0];
            const loops = [];
            for (let hour = 8; hour < 22; hour++) {
                loops.push({
                    id: `${date}_${hour}_loc_downtown`,
                    date,
                    hour,
                    status: 'APPROVED',
                    slots: Array.from({ length: 12 }, (_, i) => ({
                        position: i,
                        asset_id: `asset_${i}`,
                        duration: 5,
                        status: 'APPROVED'
                    }))
                });
            }

            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ loops, business_hours: { start: 8, end: 22 } })
            });
        });

        // Mock analytics endpoint (future implementation)
        await page.route('**/api/analytics/loops**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    summary: {
                        totalImpressions: 4500,
                        avgDeliveryRate: 95.5,
                        fullDeliveryCount: 12,
                        partialCount: 2
                    },
                    hourly: []
                })
            });
        });
    });

    test('Admin can navigate to Loop Analytics', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');
        await expect(page.getByText('Loop Analytics')).toBeVisible();
        await expect(page.getByText('Proof-of-play')).toBeVisible();
    });

    test('Analytics shows summary stats', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');

        // Check for stat cards
        await expect(page.locator('[data-testid="total-impressions"]')).toBeVisible();
        await expect(page.locator('[data-testid="avg-delivery-rate"]')).toBeVisible();
        await expect(page.locator('[data-testid="full-delivery-count"]')).toBeVisible();
        await expect(page.locator('[data-testid="partial-delivery-count"]')).toBeVisible();
    });

    test('Analytics shows hourly chart', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');

        await expect(page.locator('[data-testid="hourly-chart"]')).toBeVisible();

        // Check for business hours (8am to 9pm)
        await expect(page.locator('[data-testid="analytics-hour-8"]')).toBeVisible();
        await expect(page.locator('[data-testid="analytics-hour-14"]')).toBeVisible();
    });

    test('Admin can click hour to see slot details', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');

        // Click on 2pm slot
        await page.locator('[data-testid="analytics-hour-14"]').click();

        // Slot details should appear
        await expect(page.locator('[data-testid="slot-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="slot-detail-0"]')).toBeVisible();
    });

    test('Analytics has date picker', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');

        await expect(page.locator('[data-testid="analytics-date-picker"]')).toBeVisible();
    });

    test('Analytics shows delivery rate colors', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');

        // Legend should be visible
        await expect(page.getByText('>95%')).toBeVisible();
        await expect(page.getByText('80-95%')).toBeVisible();
        await expect(page.getByText('<80%')).toBeVisible();
    });
});
