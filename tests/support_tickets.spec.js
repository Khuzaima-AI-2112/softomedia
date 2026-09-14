import { test, expect } from '@playwright/test';

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.STORAGE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

test('Retailer Administrator reports a Support Ticket that the Technical Operator updates, without AI surfaces', async ({ page }) => {
    const password = 'Phase1-demo-password!';
    const subject = `Checkout screen offline ${Date.now()}`;
    const note = 'Technician is restarting the checkout player.';
    const { resetDemoBaseline } = await import('../ad-server/src/services/DemoResetService.js');
    const { provisionDemoPersonas } = await import('../ad-server/src/services/DemoPersonaProvisioner.js');
    const { closeFirestore, getFirestore } = await import('../ad-server/src/utils/firestore.js');
    const { getStorageClient } = await import('../ad-server/src/utils/storage.js');
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
        const ticketCard = page.getByRole('link', { name: new RegExp(subject) });

        await signIn(page, 'retaileradmin@demo.softomedia.test', password, /\/dashboard\/retailer$/);
        await page.getByTestId('nav-tickets').click();
        await page.getByTestId('btn-create-ticket').click();
        await page.getByLabel('Subject').fill(subject);
        await page.getByLabel('Category').selectOption('network');
        await page.getByLabel('Description').fill('The checkout screen shows a disconnected icon.');
        await page.getByRole('button', { name: 'Submit ticket' }).click();
        await expect(page.getByRole('status')).toHaveText('Support Ticket submitted.');
        await expect(ticketCard).toContainText('Open');
        await page.reload();
        await expect(ticketCard).toContainText('Open');
        await signOut(page);

        await signIn(page, 'techoperator@demo.softomedia.test', password, /\/dashboard\/techoperator$/);
        await page.getByTestId('nav-tickets').click();
        await ticketCard.click();
        await expect(page.getByRole('heading', { name: subject })).toBeVisible();
        await page.getByLabel('Status').selectOption('in_progress');
        await page.getByLabel('Note').fill(note);
        await page.getByRole('button', { name: 'Save update' }).click();
        await expect(page.getByTestId('ticket-status')).toHaveText('In progress');
        await expect(page.getByText(note)).toBeVisible();
        await page.reload();
        await expect(page.getByTestId('ticket-status')).toHaveText('In progress');
        await expect(page.getByText(note)).toBeVisible();
        await signOut(page);

        await signIn(page, 'retaileradmin@demo.softomedia.test', password, /\/dashboard\/retailer$/);
        await page.getByTestId('nav-tickets').click();
        await expect(ticketCard).toContainText('In progress');
        await ticketCard.click();
        await expect(page.getByText(note)).toBeVisible();
        await expect(page.getByLabel('Status')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Save update' })).toHaveCount(0);
        await signOut(page);

        await signIn(page, 'admin@demo.softomedia.test', password, /\/dashboard\/admin$/);
        await expect(page.getByTestId('nav-tickets')).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'AI Log' })).toHaveCount(0);
        await page.goto('/dashboard/tickets');
        await expect(page.getByRole('alert')).toHaveText('Access denied');
        await expect(page.getByText(subject)).toHaveCount(0);
        await page.goto('/dashboard/admin/ai-log');
        await expect(page.getByTestId('error-404')).toBeVisible();
    } finally {
        await reset();
        await closeFirestore();
    }
});

async function signIn(page, email, password, landing) {
    await page.goto('/login');
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill(password);
    await page.getByTestId('btn-login').click();
    await expect(page).toHaveURL(landing);
}

async function signOut(page) {
    await page.getByTestId('btn-user-profile').click();
    await page.getByTestId('btn-logout').click();
    await expect(page).toHaveURL(/\/login$/);
}
