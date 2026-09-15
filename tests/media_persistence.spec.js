import { test, expect, hasEmulators, signIn } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Admin uploads neutral fallback media and still sees it after reload without API interception', async ({ page, demo }) => {
    const accounts = await demo.provisionPersonas();
    const admin = accounts.find(account => account.role === 'admin');
    const title = `Browser fallback ${Date.now()}`;

    await signIn(page, admin.email, /\/dashboard\/admin$/);
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
