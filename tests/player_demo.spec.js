const { test, expect } = require('@playwright/test');

test.describe('Demo Player Verification', () => {
    // Tests should respect playwright.config.js baseURL (usually localhost:5173/5174)
    // If running against production, baseURL will be overriden by CLI or env.

    test('Demo player should load and play content', async ({ page }) => {
        // Go to demo player with a valid screen ID mock
        await page.goto('/player/demo?screenId=scr_001_01');

        // Wait for potential async data loading
        await page.waitForTimeout(3000);

        // Check for ad content (video/img) OR demo content (gradients/text)
        const hasAdContent = await page.locator('video, img').count() > 0;
        const hasDemoContent = await page.locator('h2').count() > 0; // Demo slides have h2 text

        const hasNoScheduleMessage = await page.getByText('No loops scheduled').isVisible();
        const hasErrorMessage = await page.getByText('Error loading').isVisible();

        // Log state for debugging traces
        console.log(`Ad: ${hasAdContent}, Demo: ${hasDemoContent}, NoSchedule: ${hasNoScheduleMessage}, Error: ${hasErrorMessage}`);

        if (hasErrorMessage) {
            throw new Error('Player failed to load content: Error message visible');
        }

        // fail if nothing relevant is shown
        expect(hasAdContent || hasDemoContent || hasNoScheduleMessage).toBeTruthy();
    });
});
