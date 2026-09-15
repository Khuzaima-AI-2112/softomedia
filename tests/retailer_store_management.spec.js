import { test, expect, hasEmulators, signIn } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Retailer Administrator sees only its Stores with their time zone and keeps a newly added Location', async ({ page, demo }) => {
    const locationName = `Pharmacy Placement ${Date.now()}`;
    await demo.reset();
    await demo.provisionPersonas();

    try {
        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);

        const manager = page.getByTestId('retailer-store-manager');
        await expect(manager).toBeVisible();
        await expect(page.getByTestId('store-time-zone-demo-store-mtl-north')).toHaveText('Time zone: America/Toronto');
        await expect(manager.getByText('Checkout Placement')).toBeVisible();
        // Another Retailer's Store never appears.
        await expect(manager.getByText('HarborCart Desert Synthetic Store')).toHaveCount(0);
        await expect(page.getByTestId('store-time-zone-demo-store-phoenix')).toHaveCount(0);

        await page.getByTestId('add-location-button').click();
        await page.getByTestId('location-name-input').fill(locationName);
        await page.getByTestId('location-store-select').selectOption('demo-store-mtl-north');
        await page.getByTestId('add-location-form').getByRole('button', { name: 'Create Location' }).click();
        await expect(page.getByRole('status')).toHaveText(`${locationName} was added to the selected store.`);

        await page.reload();
        await expect(page.getByTestId('retailer-store-manager').getByText(locationName)).toBeVisible();
    } finally {
        await demo.reset();
    }
});
