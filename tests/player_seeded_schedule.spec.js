import { test, expect, hasEmulators, signedInPage } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

// The demo seeds an approved schedule for today at a Store open around the clock,
// so its Screen plays without anyone generating, approving or moving the clock.
test('a Screen plays today\'s seeded schedule', async ({ page, browser, demo }) => {
    const { impressionRepository } = await import('../ad-server/src/repositories/ImpressionRepository.js');
    await demo.reset({ resetAt: new Date() });
    await demo.provisionPersonas();
    let operator;

    try {
        // The seeded Screen has no device key yet; the Technical Operator issues one.
        operator = await signedInPage(browser, 'techoperator@demo.softomedia.test', /\/dashboard\/techoperator$/);
        await operator.getByTestId('nav-screens').click();
        operator.once('dialog', dialog => dialog.accept());
        await operator.getByRole('button', { name: 'Issue new device key for "All-Day Entrance Synthetic Screen"' }).click();
        await expect(operator.getByTestId('screen-device-credential')).toContainText('demo-screen-secondary-2');
        const deviceKey = (await operator.getByTestId('screen-device-key').textContent()).trim();

        await page.goto(`/player?screen_id=demo-screen-secondary-2#key=${deviceKey}`);
        await page.reload();
        await expect(page.getByTestId('player-container')).toHaveAttribute('data-schedule-status', 'approved');
        // The reserved Creative plays in the first Paid Slot of the hour and is recorded as delivered.
        await expect(page.getByTestId('campaign-presentation')).toBeVisible();
        await expect.poll(async () => (await impressionRepository.findProofsOfPlayByCampaign('demo-secondary-campaign-1'))
            .filter(proof => proof.screen_id === 'demo-screen-secondary-2').length, { timeout: 30_000 }).toBeGreaterThan(0);
    } finally {
        await operator?.context().close();
        await demo.reset();
    }
});
