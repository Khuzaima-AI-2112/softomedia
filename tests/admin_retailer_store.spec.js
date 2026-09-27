import { test, expect, hasEmulators, signIn, signOut } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

// #43: the Add Store form sent no time zone, so the server refused every new Store.
test('Admin adds a Store to a newly created Retailer and it persists after a reload', async ({ page, demo }) => {
    const retailerName = `New Retailer ${Date.now()}`;
    const storeName = 'Admin Added Store';
    await demo.reset();
    await demo.provisionPersonas();

    try {
        // Only the Super Administrator manages organizations, so they create the Retailer.
        await signIn(page, 'superadmin@demo.softomedia.test', /\/dashboard\//);
        await page.goto('/dashboard/admin/retailers');
        await page.getByTestId('btn-add-retailer').click();
        await page.getByTestId('input-retailer-name').fill(retailerName);
        await page.getByTestId('input-retailer-contact').fill('owner@new-retailer.test');
        await page.getByTestId('btn-retailer-form-submit').click();
        await expect(page.getByTestId('modal-retailer-form')).toHaveCount(0);
        await signOut(page);

        await signIn(page, 'admin@demo.softomedia.test', /\/dashboard\/admin$/);
        await page.goto('/dashboard/admin/retailers');
        await page.getByTestId('retailers-list').getByText(retailerName).click();
        await page.getByTestId('btn-add-store').first().click();
        const storeForm = page.getByTestId('modal-store-form');
        await storeForm.getByTestId('input-store-name').fill(storeName);
        await storeForm.getByTestId('input-store-address').fill('123 Main Street');
        await storeForm.getByTestId('input-store-city').fill('Montreal');
        await storeForm.getByTestId('input-store-time-zone').fill(' America/Toronto ');
        await storeForm.getByTestId('btn-store-form-submit').click();
        await expect(storeForm).toHaveCount(0);
        await expect(page.getByTestId('stores-list').getByText(storeName)).toBeVisible();

        await page.reload();
        await page.getByTestId('retailers-list').getByText(retailerName).click();
        await expect(page.getByTestId('stores-list').getByText(storeName)).toBeVisible();
    } finally {
        await demo.removeRetailersNamed(retailerName);
        await demo.reset();
    }
});
