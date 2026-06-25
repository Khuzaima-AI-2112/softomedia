/**
 * base.fixtures.js — Playwright page fixtures for storageState-based auth.
 *
 * Each fixture provides a Playwright page pre-authenticated as a specific
 * persona. The storageState JSON files are created by global.setup.js at
 * suite startup.
 *
 * USAGE:
 *   import { test, expect } from './base.fixtures.js';
 *
 *   test('admin can see dashboard', async ({ adminPage: page }) => { ... });
 *   test('superadmin can manage users', async ({ superadminPage: page }) => { ... });
 *
 * ADDING A NEW PERSONA:
 *   1. Add it to tests/fixtures/personas.js (PERSONAS map)
 *   2. Add a page fixture below following the same pattern
 *   3. global.setup.js will automatically create the storageState file
 *
 * Design note: We use storageState (Playwright's recommended approach) for
 * root-level specs because it's faster and more deterministic than loginAs().
 * The demo_wizard suite uses loginAs() because its serial multi-persona
 * flows require dynamic auth switching within a single browser context.
 * Both approaches consume persona definitions from fixtures/personas.js.
 */

import { test as base } from '@playwright/test';

export const test = base.extend({

    superadminPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/.auth/superadmin.json'
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

    brandPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/.auth/brand.json'
        });
        const page = await context.newPage();
        await page.goto('/');
        await use(page);
        await context.close();
    },

    advertiserPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/.auth/advertiser.json'
        });
        const page = await context.newPage();
        await page.goto('/');
        await use(page);
        await context.close();
    },

    techoperatorPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/.auth/techoperator.json'
        });
        const page = await context.newPage();
        await page.goto('/');
        await use(page);
        await context.close();
    },
});

export { expect } from '@playwright/test';
