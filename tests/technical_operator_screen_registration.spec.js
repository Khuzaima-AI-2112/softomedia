import { test, expect, hasEmulators, signIn } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Technical Operator registers a Screen at a Retailer Location and receives its device key once', async ({ page, demo }) => {
    const screenId = `ui-registered-screen-${Date.now()}`;
    const { screenRepository } = await import('../ad-server/src/repositories/index.js');
    await demo.reset();
    await demo.provisionPersonas();

    try {
        await signIn(page, 'techoperator@demo.softomedia.test', /\/dashboard\/techoperator$/);

        await page.getByTestId('nav-screens').click();
        await expect(page.getByTestId('screens-list')).toBeVisible();
        await page.getByTestId('btn-add-screen').click();

        const form = page.getByTestId('modal-screen-form');
        await form.getByLabel('Screen Hardware ID').fill(screenId);
        await form.getByLabel('Retailer').selectOption('demo-retailer-freshmart');
        await form.getByLabel('Store').selectOption('demo-store-mtl-north');
        await form.getByLabel('Location').selectOption('demo-location-mtl-checkout');
        await page.getByTestId('btn-screen-form-submit').click();

        const credential = page.getByTestId('screen-device-credential');
        await expect(credential).toContainText(screenId);
        await expect(page.getByTestId('screen-device-key')).not.toBeEmpty();
        await expect(page.getByTestId('screen-player-link')).toHaveAttribute('href', new RegExp(`screen_id=${screenId}#key=`));

        const registered = await screenRepository.findById(screenId);
        expect(registered).toMatchObject({
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-checkout',
        });

        await page.reload();
        await expect(page.getByTestId('screens-list')).toContainText(screenId);
        await expect(page.getByTestId('screen-device-credential')).toHaveCount(0);
    } finally {
        await demo.reset();
    }
});
