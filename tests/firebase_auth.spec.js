const { test, expect } = require('@playwright/test');

const password = 'Phase1-demo-password!';

const routeByRole = {
    superadmin: '/dashboard/admin',
    admin: '/dashboard/admin',
    brand: '/dashboard/brand',
    retaileradmin: '/dashboard/retailer',
    techoperator: '/dashboard/techoperator',
};

let accounts;

test.beforeAll(async () => {
    const { provisionDemoPersonas } = await import('../ad-server/src/services/DemoPersonaProvisioner.js');
    accounts = await provisionDemoPersonas({
        password,
        expectedProjectId: 'softomedia-demo',
    });
});

test.describe.serial('Firebase email-and-password authentication', () => {
    for (const role of Object.keys(routeByRole)) {
        test(`${role} signs in and reaches the correct dashboard`, async ({ page }) => {
            const account = accounts.find(item => item.role === role);
            await page.goto('/login');
            await page.getByTestId('input-email').fill(account.email);
            await page.getByTestId('input-password').fill(password);
            await page.getByTestId('btn-login').click();

            await expect(page).toHaveURL(new RegExp(`${routeByRole[role]}$`));
            await expect(page.getByTestId('dashboard-shell')).toBeVisible();
            await expect(page.locator('[data-testid^="quick-login-"]')).toHaveCount(0);
            await expect(page.getByTestId('persona-switcher')).toHaveCount(0);

            await page.getByTestId('btn-user-profile').click();
            await page.getByTestId('btn-logout').click();
            await expect(page).toHaveURL(/\/login$/);
            await page.goto('/dashboard');
            await expect(page).toHaveURL(/\/login$/);
        });
    }

    test('switching personas requires logout and a second account sign-in', async ({ page }) => {
        const superadmin = accounts.find(item => item.role === 'superadmin');
        const brand = accounts.find(item => item.role === 'brand');

        await page.goto('/login');
        await page.getByTestId('input-email').fill(superadmin.email);
        await page.getByTestId('input-password').fill(password);
        await page.getByTestId('btn-login').click();
        await expect(page).toHaveURL(/\/dashboard\/admin$/);

        await page.getByTestId('btn-user-profile').click();
        await page.getByTestId('btn-logout').click();
        await page.getByTestId('input-email').fill(brand.email);
        await page.getByTestId('input-password').fill(password);
        await page.getByTestId('btn-login').click();

        await expect(page).toHaveURL(/\/dashboard\/brand$/);
        await expect(page.getByTestId('nav-brand')).toBeVisible();
    });

    test('wrong credentials show one truthful error and do not create a session', async ({ page }) => {
        await page.goto('/login');
        await page.getByTestId('input-email').fill(accounts[0].email);
        await page.getByTestId('input-password').fill('definitely-wrong');
        await page.getByTestId('btn-login').click();

        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByTestId('login-error')).toHaveText('Unable to sign in with those credentials.');
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login$/);
    });
});
