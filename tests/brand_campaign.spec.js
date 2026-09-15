import fs from 'node:fs';
import { test, expect, hasEmulators, signIn, signOut } from './fixtures/demo-session.js';

const BRAND_DASHBOARD = /\/dashboard\/brand$/;

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Brand discovers inventory, uploads a creative, and retains only its Campaign after account switches', async ({ page, demo }) => {
    const title = `BonVie browser campaign ${Date.now()}`;
    await demo.reset();
    const accounts = await demo.provisionPersonas();
    const brand = accounts.find(account => account.email === 'brand@demo.softomedia.test');
    const secondaryBrand = accounts.find(account => account.email === 'brand-secondary@demo.softomedia.test');

    try {
        await signIn(page, brand.email, BRAND_DASHBOARD);
        await page.getByTestId('new-campaign-btn').click();

        await expect(page.getByText('HarborCart Synthetic Retailer')).toBeVisible();
        await page.getByTestId('store-harborcart-desert-synthetic-store').click();
        await expect(page.getByText('Entrance Placement').first()).toBeVisible();
        await expect(page.getByText('1920x1080').first()).toBeVisible();
        await expect(page.getByText('$15.00 CPM').first()).toBeVisible();

        await page.getByTestId('screen-desert-entrance-synthetic-screen').click();
        await page.getByTestId('step-1-next-btn').click();
        await page.getByTestId('input-campaign-name').fill(title);
        await page.getByTestId('step-2-next-btn').click();
        await page.getByTestId('step-3-next-btn').click();

        await page.getByLabel('Creative title').fill(`${title} creative`);
        await page.getByLabel('Creative file').setInputFiles({
            name: 'bonvie-creative.jpg',
            mimeType: 'image/jpeg',
            buffer: fs.readFileSync('ads/demo_ad_1.png'),
        });
        await page.getByRole('button', { name: 'Upload creative' }).click();
        await expect(page.getByRole('status')).toHaveText('Creative uploaded successfully.');
        await page.getByTestId('wizard-next-step').click();
        await page.getByTestId('btn-submit-campaign').click();

        await expect(page).toHaveURL(/\/dashboard\/brand$/);
        await expect(page.getByText(title)).toBeVisible();
        await expect(page.getByTestId('campaign-status').filter({ hasText: 'Pending' })).toBeVisible();
        await expect(page.getByText('0 Proofs of Play')).toBeVisible();
        await expect(page.getByText('demo-screen-secondary-1')).toBeVisible();
        await expect(page.getByRole('img', { name: `${title} creative` })).toBeVisible();

        await page.reload();
        await expect(page.getByText(title)).toBeVisible();
        await expect(page.getByText('demo-screen-secondary-1')).toBeVisible();
        await expect(page.getByRole('img', { name: `${title} creative` })).toBeVisible();

        await signOut(page);
        await signIn(page, secondaryBrand.email, BRAND_DASHBOARD);
        await expect(page.getByText(title)).toHaveCount(0);

        await signOut(page);
        await signIn(page, brand.email, BRAND_DASHBOARD);
        await expect(page.getByText(title)).toBeVisible();
        await expect(page.getByText('demo-screen-secondary-1')).toBeVisible();
        await expect(page.getByRole('img', { name: `${title} creative` })).toBeVisible();
    } finally {
        await demo.reset();
    }
});
