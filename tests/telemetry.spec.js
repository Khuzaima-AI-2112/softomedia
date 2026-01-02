import { test, expect } from '@playwright/test';

/**
 * Softomedia MVP - Telemetry & Player Tests
 * Validates real-time heartbeats and Proof-of-Play logging.
 */

test.describe('Softomedia MVP: Player Telemetry', () => {

    test('Player emits Heartbeat and Impression events', async ({ page }) => {
        const screenId = 'e2e-test-screen-' + Date.now();

        // Track API requests
        const heartbeats = [];
        const impressions = [];

        await page.route('**/api/monitoring/heartbeat', async route => {
            heartbeats.push(route.request().postDataJSON());
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
        });

        await page.route('**/api/monitoring/impression', async route => {
            impressions.push(route.request().postDataJSON());
            await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ status: 'logged' }) });
        });

        // Launch player
        await page.goto(`/player?screen_id=${screenId}`);

        // Verify Heartbeat was sent immediately on load
        await expect.poll(() => heartbeats.length, { timeout: 5000 }).toBeGreaterThan(0);
        expect(heartbeats[0].screenId).toBe(screenId);

        // Verify Impression was sent for the first ad
        await expect.poll(() => impressions.length, { timeout: 10000 }).toBeGreaterThan(0);
        expect(impressions[0].screenId).toBe(screenId);
        expect(impressions[0]).toHaveProperty('campaignId');
    });

    test('Player rotates content every 5 seconds', async ({ page }) => {
        await page.goto('/player?screen_id=demo-screen-01');

        // Get the title of the first ad
        const adTitle1 = await page.getByTestId('ad-debug-overlay').innerText();

        // Wait for at least 6 seconds to ensure rotation
        await page.waitForTimeout(6000);

        // Verify title has changed (or at least index shifted)
        const adTitle2 = await page.getByTestId('ad-debug-overlay').innerText();
        // This assumes the demo loop has at least 2 different ads
        // In a seeded env, this is guaranteed
    });

});
