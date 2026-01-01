import { test as base } from '@playwright/test';
import path from 'path';

export const test = base.extend({
    // Use these fixtures to get a page already "logged in" as a specific persona
    brandPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/.auth/brand.json'
        });
        const page = await context.newPage();
        await page.goto('/');
        await use(page);
        await context.close();
    },

    adminPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/.auth/admin.json'
        });
        const page = await context.newPage();
        await page.goto('/');
        await use(page);
        await context.close();
    },

    retailerPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/.auth/retailer.json'
        });
        const page = await context.newPage();
        await page.goto('/');
        await use(page);
        await context.close();
    },
});

export { expect } from '@playwright/test';
