import { test, expect } from '@playwright/test';

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.STORAGE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Admin uploads neutral fallback media and still sees it after reload without API interception', async ({ page }) => {
    const password = 'Phase1-demo-password!';
    const { provisionDemoPersonas } = await import('../ad-server/src/services/DemoPersonaProvisioner.js');
    const accounts = await provisionDemoPersonas({ password, expectedProjectId: 'softomedia-demo' });
    const admin = accounts.find(account => account.role === 'admin');
    const title = `Browser fallback ${Date.now()}`;

    await page.addInitScript(() => {
        window.ENV = {
            VITE_API_URL: 'http://localhost:8080',
            VITE_FIREBASE_PROJECT_ID: 'softomedia-demo',
            VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
        };
    });
    await page.goto('/login');
    await page.getByTestId('input-email').fill(admin.email);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-login').click();
    await page.getByTestId('nav-media').click();

    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Category').selectOption('fallback');
    await page.getByLabel('Media file').setInputFiles('tests/test-ad.png');
    await page.getByRole('button', { name: 'Upload media' }).click();

    await expect(page.getByRole('status')).toHaveText('Media uploaded successfully.');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Neutral fallback').last()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
});
