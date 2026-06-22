/**
 * global.setup.js
 * Playwright globalSetup — runs before ALL test suites (not just demo_wizard).
 *
 * Changes from original:
 *
 * 1. localStorage key: auth_token → authToken (camelCase).
 *    demo.fixtures.js assertRoleHeader() reads 'authToken'. The original wrote
 *    'auth_token' (snake_case). They were two different keys — every
 *    assertRoleHeader() call in the codebase was reading undefined.
 *    Both keys are now written for backward compatibility with any spec that
 *    hasn't migrated to demo.fixtures.js yet (see 00_seed.setup.js).
 *
 * 2. linked_entity_id added to mockUser.
 *    campaigns.js POST T5 stamping reads req.user.linked_entity_id and writes
 *    it as advertiser_id. Without it, every brand/advertiser campaign creation
 *    wrote advertiser_id: null to Firestore — an orphaned document that then
 *    triggered the 409 inventory-full conflict on the second test run.
 *
 * 3. 'techoperator' added to personas array.
 *    Was missing — loginAs(DEMO_TECHOP) in Phase 5 threw immediately because
 *    tests/.auth/techoperator.json did not exist.
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import demoSeedSetup from './demo_wizard/00_seed.setup.js';

// linked_entity_id values mirror 00_seed.setup.js constants.
// Keep in sync if entity IDs change.
const PERSONA_ENTITIES = {
    brand:         'demo-advertiser-bonvie',
    admin:         'entity-admin-001',
    retailer:      'demo-retailer-freshmart',
    techoperator:  'entity-techop-001',
};

async function globalSetup(config) {
    const { baseURL } = config.projects[0].use;
    const browser = await chromium.launch();

    if (!fs.existsSync('tests/.auth')) {
        fs.mkdirSync('tests/.auth');
    }

    // 'techoperator' added — required for Phase 5 storageState.
    const personas = ['brand', 'admin', 'retailer', 'techoperator'];

    for (const persona of personas) {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(baseURL);

        await page.evaluate(({ p, entityId }) => {
            const mockUser = {
                id:               `user-${p}`,
                email:            `${p}@softomedia.com`,
                name:             `Test ${p.charAt(0).toUpperCase() + p.slice(1)}`,
                role:             p,
                linked_entity_id: entityId,  // fix: campaigns.js T5 advertiser_id stamping
            };
            localStorage.setItem('active_persona', p);
            localStorage.setItem('demo_role',      p);
            localStorage.setItem('authToken',      'demo-token');  // PRIMARY (camelCase — matches demo.fixtures.js)
            localStorage.setItem('auth_token',     'demo-token');  // LEGACY  (snake_case — backward compat)
            localStorage.setItem('auth_user',      JSON.stringify(mockUser));
        }, { p: persona, entityId: PERSONA_ENTITIES[persona] ?? null });

        await page.context().storageState({ path: `tests/.auth/${persona}.json` });
        await context.close();
    }

    await browser.close();

    if (process.env.ALLOW_DEMO_MODE === 'true') {
        await demoSeedSetup(config);
    }
}

export default globalSetup;
