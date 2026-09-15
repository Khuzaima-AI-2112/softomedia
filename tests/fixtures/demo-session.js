/**
 * Real Phase 1 demo sessions for browser journeys.
 *
 * Journeys sign in through the login page against the Firebase emulators and
 * read and write through the real API; nothing is intercepted. The demo
 * baseline and personas come from the same services the demo reset uses.
 */
import { test as base, expect } from '@playwright/test';

export { expect };

export const PASSWORD = 'Phase1-demo-password!';

export const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.STORAGE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);

const BROWSER_ENV = {
    VITE_API_URL: 'http://localhost:8080',
    VITE_FIREBASE_PROJECT_ID: 'softomedia-demo',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
};

export const test = base.extend({
    // One Firestore client serves every journey in a worker and is closed once, at the end.
    demo: [async ({}, use) => {
        const { resetDemoBaseline } = await import('../../ad-server/src/services/DemoResetService.js');
        const { provisionDemoPersonas } = await import('../../ad-server/src/services/DemoPersonaProvisioner.js');
        const { closeFirestore, getFirestore } = await import('../../ad-server/src/utils/firestore.js');
        const { getStorageClient } = await import('../../ad-server/src/utils/storage.js');

        await use({
            reset: () => resetDemoBaseline({
                firestore: getFirestore(),
                storage: getStorageClient(),
                activeProjectId: 'softomedia-demo',
                expectedProjectId: 'softomedia-demo',
                bucketName: process.env.DEMO_ASSETS_BUCKET || 'softomedia-demo.firebasestorage.app',
                resetAt: new Date('2030-01-15T10:30:00.000Z'),
            }),
            provisionPersonas: () => provisionDemoPersonas({ password: PASSWORD, expectedProjectId: 'softomedia-demo' }),
        });

        await closeFirestore();
    }, { scope: 'worker' }],

    // Every page talks to the local API and the Auth emulator.
    page: async ({ page }, use) => {
        await page.addInitScript(env => { window.ENV = env; }, BROWSER_ENV);
        await use(page);
    },
});

/** Signs in through the login page and waits for the persona's dashboard. */
export async function signIn(page, email, landing) {
    await page.goto('/login');
    await page.getByTestId('input-email').fill(email);
    await page.getByTestId('input-password').fill(PASSWORD);
    await page.getByTestId('btn-login').click();
    await expect(page).toHaveURL(landing);
}

export async function signOut(page) {
    await page.getByTestId('btn-user-profile').click();
    await page.getByTestId('btn-logout').click();
    await expect(page).toHaveURL(/\/login$/);
}

/** A new signed-in page in its own browser context, for journeys with two personas at once. */
export async function signedInPage(browser, email, landing) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(env => { window.ENV = env; }, BROWSER_ENV);
    await signIn(page, email, landing);
    return page;
}
