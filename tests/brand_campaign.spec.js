import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.STORAGE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Brand discovers inventory, uploads a creative, and retains only its Campaign after account switches', async ({ page }) => {
    const password = 'Phase1-demo-password!';
    const title = `BonVie browser campaign ${Date.now()}`;
    const { resetDemoBaseline } = await import('../ad-server/src/services/DemoResetService.js');
    const { provisionDemoPersonas } = await import('../ad-server/src/services/DemoPersonaProvisioner.js');
    const { closeFirestore, getFirestore } = await import('../ad-server/src/utils/firestore.js');
    const { getStorageClient } = await import('../ad-server/src/utils/storage.js');
    const firestore = getFirestore();
    const storage = getStorageClient();
    const reset = () => resetDemoBaseline({
        firestore,
        storage,
        activeProjectId: 'softomedia-demo',
        expectedProjectId: 'softomedia-demo',
        bucketName: process.env.DEMO_ASSETS_BUCKET || 'softomedia-demo.firebasestorage.app',
        resetAt: new Date('2030-01-15T10:30:00.000Z'),
    });

    await reset();
    const accounts = await provisionDemoPersonas({ password, expectedProjectId: 'softomedia-demo' });
    const brand = accounts.find(account => account.email === 'brand@demo.softomedia.test');
    const secondaryBrand = accounts.find(account => account.email === 'brand-secondary@demo.softomedia.test');

    try {
        await page.addInitScript(() => {
            window.ENV = {
                VITE_API_URL: 'http://localhost:8080',
                VITE_FIREBASE_PROJECT_ID: 'softomedia-demo',
                VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
            };
        });
        await signIn(page, brand.email, password);
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

        await page.getByTestId('btn-user-profile').click();
        await page.getByTestId('btn-logout').click();
        await signIn(page, secondaryBrand.email, password);
        await expect(page.getByText(title)).toHaveCount(0);

        await page.getByTestId('btn-user-profile').click();
        await page.getByTestId('btn-logout').click();
        await signIn(page, brand.email, password);
        await expect(page.getByText(title)).toBeVisible();
        await expect(page.getByText('demo-screen-secondary-1')).toBeVisible();
        await expect(page.getByRole('img', { name: `${title} creative` })).toBeVisible();
    } finally {
        await reset();
        await closeFirestore();
    }
});

async function signIn(page, email, password) {
    await page.goto('/login');
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-login').click();
    await expect(page).toHaveURL(/\/dashboard\/brand$/);
}
