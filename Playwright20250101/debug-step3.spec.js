import { test, expect } from '@playwright/test';

/**
 * Debug Test: Step 3 Button Investigation
 * Run with: npx playwright test debug-step3.spec.js --headed
 */

test('Debug: Step 3 Button State Inspection', async ({ page }) => {
    // Navigate directly to the wizard
    await page.goto('/dashboard/brand/campaign/new');

    console.log('=== STEP 1: Location & Screen ===');

    // Step 1: Select store and screen
    await page.locator('[data-testid="store-downtown-flagship"]').click();
    console.log('✓ Store selected');

    await page.locator('[data-testid="screen-main-entrance-kiosk-a"]').click();
    console.log('✓ Screen selected');

    await page.locator('[data-testid="wizard-next-step"]').click();
    console.log('✓ Navigated to Step 2');

    // Wait for Step 2 to load
    await expect(page.getByText(/campaign duration/i)).toBeVisible();
    console.log('=== STEP 2: Schedule & Upload ===');

    // Step 2: Select timeslot and upload creative
    await page.locator('[data-testid^="timeslot-08:00"]').first().click();
    console.log('✓ Timeslot selected');

    await page.locator('[data-testid="upload-creative-area"]').click();
    console.log('✓ Creative uploaded');

    // Check if "Proceed to Review" button is enabled
    const proceedBtn = page.locator('[data-testid="proceed-to-review"]');
    const isProceedEnabled = await proceedBtn.isEnabled();
    console.log(`Proceed button enabled: ${isProceedEnabled}`);

    if (!isProceedEnabled) {
        console.log('❌ BLOCKED AT STEP 2: Proceed button is disabled');

        // Capture DOM snapshot
        const html = await page.content();
        console.log('--- DOM Snapshot (Sidebar Summary) ---');
        const sidebar = await page.locator('aside').innerHTML();
        console.log(sidebar);

        // Pause for visual inspection
        await page.pause();
        return;
    }

    await proceedBtn.click();
    console.log('✓ Navigated to Step 3');

    // Wait for Step 3 to load
    await expect(page.getByText(/visualization/i)).toBeVisible();
    console.log('=== STEP 3: Review & Distribution ===');

    // Find the confirm button
    const confirmBtn = page.locator('[data-testid="confirm-distribution-btn"]');

    // Check button state
    const isVisible = await confirmBtn.isVisible();
    const isEnabled = await confirmBtn.isEnabled();
    const buttonHTML = await confirmBtn.evaluate(el => el.outerHTML);

    console.log(`Button visible: ${isVisible}`);
    console.log(`Button enabled: ${isEnabled}`);
    console.log(`Button HTML: ${buttonHTML}`);

    // Check for error boundary
    const hasError = await page.locator('.error-boundary, [data-testid="error-fallback"]').count();
    console.log(`Error boundary active: ${hasError > 0}`);

    // Capture full page screenshot
    await page.screenshot({ path: 'debug-step3-screenshot.png', fullPage: true });
    console.log('✓ Screenshot saved to debug-step3-screenshot.png');

    // Pause for manual inspection in headed mode
    await page.pause();
});
