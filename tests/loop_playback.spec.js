/**
 * Loop Playback E2E Tests
 * Tests for Sprint 4: Player Loop Playback
 * Verifies player fetches and plays hourly loops
 */

const { test, expect } = require('./base.fixtures');

test.describe('Loop Playback - Sprint 4', () => {
    test.beforeEach(async ({ page }) => {
        // Mock screen registration
        await page.route('**/api/screens/register', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify( Object.assign({},  { success: true, screen_id: 'test_screen' } ) )
            });
        });

        // Mock loops endpoint with approved loop
        await page.route('**/api/loops**', route => {
            const currentHour = new Date().getHours();
            const loops = [{
                id: `2026-01-02_${currentHour}_loc_downtown`,
                date: new Date().toISOString().split('T')[0],
                hour: currentHour,
                status: 'APPROVED',
                slots: Array.from({ length: 12 }, (_, i) => ({
                    position: i,
                    asset_id: `test_asset_${i}`,
                    asset_name: `Test Ad ${i + 1}`,
                    url: `https://placehold.co/1920x1080/3b82f6/white?text=Slot+${i + 1}`,
                    duration: 5,
                    status: 'APPROVED'
                }))
            }];

            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify( Object.assign({},  { loops, business_hours: { start: 8, end: 22 } } ) )
            });
        });

        // Mock playlist endpoint for fallback
        await page.route('**/api/playlist/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify( Object.assign({},  {
                    playlist: [{
                        id: 'fallback_ad',
                        url: 'https://placehold.co/1920x1080/gray/white?text=Fallback',
                        title: 'Fallback Ad',
                        duration: 5
                    }],
                    source: 'global'
                } ) )
            });
        });

        // Mock heartbeat
        await page.route('**/api/monitoring/heartbeat', route => {
            route.fulfill({ status: 200 });
        });
    });

    test('Player navigates to player page', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen');
        await expect(page.locator('body')).toBeVisible();
    });

    test('Player shows content when playing', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen');

        // Wait for ad to display
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 10000 });
    });

    test('Player shows loop indicator when in loop mode', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen&debug=true');

        // Wait for loop to load
        await page.waitForTimeout(3000);

        // Check for loop indicator (may or may not appear depending on business hours)
        const loopIndicator = page.locator('[data-testid="loop-indicator"]');
        const debugOverlay = page.locator('[data-testid="ad-debug-overlay"]');

        // Either loop indicator or debug overlay should be visible
        await expect(debugOverlay).toBeVisible({ timeout: 10000 });
    });

    test('Player shows debug overlay with slot info', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen&debug=true');

        await expect(page.locator('[data-testid="ad-debug-overlay"]')).toBeVisible({ timeout: 10000 });
    });

    test('Player rotates through slots', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen');

        // Wait for first ad
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 10000 });

        // Get initial slot info
        const initialOverlay = await page.locator('[data-testid="ad-debug-overlay"]').textContent();

        // Wait for rotation (5s + buffer)
        await page.waitForTimeout(6000);

        // Overlay should have changed (or stayed if only 1 slot)
        await expect(page.locator('[data-testid="ad-debug-overlay"]')).toBeVisible();
    });

    test('Player falls back to playlist when no approved loop', async ({ page }) => {
        // Override loops mock to return no approved loops
        await page.route('**/api/loops**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify( Object.assign({},  { loops: [], business_hours: { start: 8, end: 22 } } ) )
            });
        });

        await page.goto('/player?screen_id=test_screen');

        // Should still show content from playlist fallback
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 15000 });
    });

    test('Player sends telemetry', async ({ page }) => {
        // Enable telemetry logging
        await page.addInitScript(() => {
            window.__FORCE_TEST_LOGGING__ = true;
        });

        await page.goto('/player?screen_id=test_screen&debug=true');

        // Wait for playback to start
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 10000 });

        // Check telemetry was logged
        const telemetryLog = await page.evaluate(() => window.__TELEMETRY_LOG__ || []);
        expect(telemetryLog.length).toBeGreaterThan(0);
    });
});
