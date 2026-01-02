import { test, expect } from '@playwright/test';

/**
 * Debug Test: Step 2 Upload & Slot Investigation
 * Run with: npx playwright test debug-step2.spec.js --headed
 */

test('Debug: Step 2 State Inspection', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

    // Navigate directly to the wizard
    await page.goto('/dashboard/brand/campaign/new');

    console.log('[TEST] === STEP 1: Quick Setup ===');

    // Step 1: Select store and screen
    await page.locator('[data-testid="store-downtown-flagship"]').click();
    await page.locator('[data-testid="screen-main-entrance-kiosk-a"]').click();
    await page.locator('[data-testid="wizard-next-step"]').click();

    // Wait for Step 2 to load
    await expect(page.getByText(/campaign duration/i)).toBeVisible();
    console.log('[TEST] === STEP 2: State Inspection ===');

    // Check initial state
    const initialState = await page.evaluate(() => {
        // Try to access React state via debug hooks if available
        return {
            localStorage: JSON.stringify(localStorage),
            url: window.location.href
        };
    });
    console.log('[TEST] Initial state:', JSON.stringify(initialState, null, 2));

    // Check proceed button initial state
    const proceedBtn = page.locator('[data-testid="proceed-to-review"]');
    const initialDisabled = await proceedBtn.isDisabled();
    console.log(`[TEST] Proceed button initially disabled: ${initialDisabled}`);

    // ===== TEST SLOT SELECTION =====
    console.log('[TEST] === TESTING SLOT SELECTION ===');

    const slotButton = page.locator('[data-testid^="timeslot-08:00"]').first();
    const slotExists = await slotButton.count() > 0;
    console.log(`[TEST] Slot button exists: ${slotExists}`);

    if (slotExists) {
        await slotButton.click();
        await page.waitForTimeout(500); // Wait for state update

        // Check if slot is now selected (has active class)
        const slotClasses = await slotButton.getAttribute('class');
        const slotSelected = slotClasses?.includes('border-primary');
        console.log(`[TEST] Slot selected (border-primary): ${slotSelected}`);
        console.log(`[TEST] Slot classes: ${slotClasses}`);
    }

    // Check proceed button after slot
    const afterSlotDisabled = await proceedBtn.isDisabled();
    console.log(`[TEST] Proceed button disabled after slot: ${afterSlotDisabled}`);

    // ===== TEST FILE UPLOAD =====
    console.log('[TEST] === TESTING FILE UPLOAD ===');

    const uploadArea = page.locator('[data-testid="upload-creative-area"]');
    const uploadExists = await uploadArea.count() > 0;
    console.log(`[TEST] Upload area exists: ${uploadExists}`);

    if (uploadExists) {
        // Capture the upload area's current content
        const beforeUploadText = await uploadArea.innerText();
        console.log(`[TEST] Before upload text: "${beforeUploadText}"`);

        await uploadArea.click();
        await page.waitForTimeout(1000); // Wait for async upload

        // Check if upload area content changed
        const afterUploadText = await uploadArea.innerText();
        console.log(`[TEST] After upload text: "${afterUploadText}"`);

        const uploadSucceeded = afterUploadText.includes('demo-ad.mp4') || afterUploadText.includes('check_circle');
        console.log(`[TEST] Upload appears successful: ${uploadSucceeded}`);
    }

    // ===== FINAL STATE CHECK =====
    console.log('[TEST] === FINAL STATE CHECK ===');

    const finalDisabled = await proceedBtn.isDisabled();
    console.log(`[TEST] Proceed button FINAL disabled: ${finalDisabled}`);

    if (finalDisabled) {
        console.log('[TEST] ❌ BLOCKED: Proceed button still disabled');

        // Get button's disabled attribute
        const btnHTML = await proceedBtn.evaluate(el => el.outerHTML);
        console.log(`[TEST] Button HTML: ${btnHTML}`);

        // Get sidebar summary to see what data is missing
        const sidebarText = await page.locator('aside').first().innerText();
        console.log(`[TEST] Sidebar summary:\n${sidebarText}`);
    } else {
        console.log('[TEST] ✓ SUCCESS: Proceed button is enabled!');
    }

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'debug-step2-final.png', fullPage: true });
    console.log('[TEST] Screenshot saved to debug-step2-final.png');

    // Pause for manual inspection in headed mode
    await page.pause();
});
