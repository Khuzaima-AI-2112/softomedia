const { test, expect } = require('@playwright/test');

test('Ad Player transitions images every 5 seconds', async ({ page }) => {
    // 1. Navigate to the ad player
    await page.goto('/player');

    // 2. Wait for the player to initialize and load the first ad
    // The player shows "Connecting..." or "Loading Content..." initially
    const adImage = page.locator('img');
    await expect(adImage).toBeVisible({ timeout: 15000 });

    // 3. Record the initial image src
    const initialSrc = await adImage.getAttribute('src');
    console.log(`Initial Ad: ${initialSrc}`);

    // 4. Wait for the first transition (5 seconds + small buffer)
    // Our system transitions every 5 seconds as per ad-server duration
    await page.waitForTimeout(6000);

    // 5. Verify the src has changed
    const secondSrc = await adImage.getAttribute('src');
    console.log(`Second Ad: ${secondSrc}`);
    expect(secondSrc).not.toBe(initialSrc);

    // 6. Wait for another transition
    await page.waitForTimeout(6000);

    // 7. Verify the src has changed again
    const thirdSrc = await adImage.getAttribute('src');
    console.log(`Third Ad: ${thirdSrc}`);
    expect(thirdSrc).not.toBe(secondSrc);

    // 8. Capture a screenshot of the current ad for verification
    await page.screenshot({ path: 'tests/screenshots/ad_player_test.png' });
});
