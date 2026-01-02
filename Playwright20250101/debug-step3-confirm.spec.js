import { test, expect } from '@playwright/test';

/**
 * Debug Test: Step 3 Confirm Button Investigation
 */
test('Debug: Step 3 Confirm Button', async ({ page }) => {
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

    await page.goto('/dashboard/brand/campaign/new');

    // Step 1
    await page.locator('[data-testid="store-downtown-flagship"]').click();
    await page.locator('[data-testid="screen-main-entrance-kiosk-a"]').click();
    await page.locator('[data-testid="wizard-next-step"]').click();

    // Step 2
    await page.locator('[data-testid^="timeslot-08:00"]').first().click();
    await page.locator('[data-testid="upload-creative-area"]').click();
    await page.waitForTimeout(2000); // Long wait for upload
    await page.locator('[data-testid="proceed-to-review"]').click();

    // Step 3 - Debug
    console.log('[DEBUG] Waiting for Step 3 content...');
    await expect(page.getByText(/visualization/i)).toBeVisible({ timeout: 10000 });
    console.log('[DEBUG] Step 3 loaded');

    // Find confirm button
    const confirmBtn = page.locator('[data-testid="confirm-distribution-btn"]');

    const exists = await confirmBtn.count() > 0;
    console.log(`[DEBUG] Confirm button exists: ${exists}`);

    if (exists) {
        const isVisible = await confirmBtn.isVisible();
        const isEnabled = await confirmBtn.isEnabled();
        const html = await confirmBtn.evaluate(el => el.outerHTML);

        console.log(`[DEBUG] Button visible: ${isVisible}`);
        console.log(`[DEBUG] Button enabled: ${isEnabled}`);
        console.log(`[DEBUG] Button HTML: ${html}`);

        if (isEnabled) {
            console.log('[DEBUG] ✓ Button is enabled, clicking...');
            await confirmBtn.click();
            await expect(page).toHaveURL(/.*dashboard\/brand/);
            console.log('[DEBUG] ✓ Navigation successful!');
        } else {
            console.log('[DEBUG] ❌ Button is disabled');
            await page.screenshot({ path: 'step3-disabled-btn.png' });
        }
    } else {
        console.log('[DEBUG] ❌ Button not found in DOM');
        const pageContent = await page.content();
        console.log('[DEBUG] Page HTML snippet:', pageContent.substring(0, 2000));
    }
});
