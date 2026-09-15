import { test, expect } from '@playwright/test';

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.STORAGE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Technical Operator registers a Screen at a Retailer Location and receives its device key once', async ({ page }) => {
    const password = 'Phase1-demo-password!';
    const screenId = `ui-registered-screen-${Date.now()}`;
    const { resetDemoBaseline } = await import('../ad-server/src/services/DemoResetService.js');
    const { provisionDemoPersonas } = await import('../ad-server/src/services/DemoPersonaProvisioner.js');
    const { closeFirestore, getFirestore } = await import('../ad-server/src/utils/firestore.js');
    const { getStorageClient } = await import('../ad-server/src/utils/storage.js');
    const { screenRepository } = await import('../ad-server/src/repositories/index.js');
    const reset = () => resetDemoBaseline({
        firestore: getFirestore(),
        storage: getStorageClient(),
        activeProjectId: 'softomedia-demo',
        expectedProjectId: 'softomedia-demo',
        bucketName: process.env.DEMO_ASSETS_BUCKET || 'softomedia-demo.firebasestorage.app',
        resetAt: new Date('2030-01-15T10:30:00.000Z'),
    });

    await reset();
    await provisionDemoPersonas({ password, expectedProjectId: 'softomedia-demo' });

    try {
        await page.addInitScript(() => {
            window.ENV = {
                VITE_API_URL: 'http://localhost:8080',
                VITE_FIREBASE_PROJECT_ID: 'softomedia-demo',
                VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
            };
        });

        await page.goto('/login');
        await page.getByTestId('input-email').fill('techoperator@demo.softomedia.test');
        await page.getByTestId('input-password').fill(password);
        await page.getByTestId('btn-login').click();
        await expect(page).toHaveURL(/\/dashboard\/techoperator$/);

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
        await reset();
        await closeFirestore();
    }
});
