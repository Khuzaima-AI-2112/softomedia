/**
 * global.setup.js
 * Playwright globalSetup — runs before ALL test suites (not just demo_wizard).
 *
 * Changes from original:
 *
 * 1. Persona definitions imported from tests/fixtures/personas.js (single
 *    source of truth). All persona constants, entity IDs, and role values
 *    are now maintained in one place.
 *
 * 2. All 6 personas are now registered (was 4): superadmin and advertiser
 *    added. storageState files are written for each.
 *
 * 3. localStorage key: auth_token → authToken (camelCase).
 *    demo.fixtures.js assertRoleHeader() reads 'authToken'. The original wrote
 *    'auth_token' (snake_case). Both keys are now written for backward
 *    compatibility with any spec that hasn't migrated yet.
 *
 * 4. linked_entity_id added to mockUser.
 *    campaigns.js POST T5 stamping reads req.user.linked_entity_id and writes
 *    it as advertiser_id.
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import { PERSONA_SETUP_LIST, DEMO_TOKEN } from './fixtures/personas.js';
import demoSeedSetup from './demo_wizard/00_seed.setup.js';

async function globalSetup(config) {
    // Reset database to ensure isolated clean environment
    try {
        console.log('🔄 Resetting backend database for E2E run...');
        const res = await fetch('http://localhost:8080/api/debug/reset', { method: 'POST' });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Database reset failed: ${res.status} ${res.statusText} - ${errText}`);
        }
        console.log('✅ Database successfully flushed and re-seeded.');
    } catch (err) {
        console.error('❌ Warning: Database reset failed during globalSetup:', err.message);
    }

    const { baseURL } = config.projects[0].use;
    const browser = await chromium.launch();

    if (!fs.existsSync('tests/.auth')) {
        fs.mkdirSync('tests/.auth', { recursive: true });
    }

    for (const persona of PERSONA_SETUP_LIST) {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(baseURL);

        await page.evaluate(({ p, token }) => {
            const mockUser = {
                id:               p.id,
                email:            p.email,
                name:             p.displayName,
                role:             p.role,
                linked_entity_id: p.linkedEntityId,
            };
            localStorage.setItem('active_persona', p.role);
            localStorage.setItem('demo_role',      p.role);
            localStorage.setItem('authToken',      token);   // PRIMARY (camelCase — matches demo.fixtures.js)
            localStorage.setItem('auth_token',     token);   // LEGACY  (snake_case — backward compat)
            localStorage.setItem('auth_user',      JSON.stringify(mockUser));
        }, { p: persona, token: DEMO_TOKEN });

        await page.context().storageState({ path: `tests/.auth/${persona.key}.json` });
        await context.close();
    }

    await browser.close();

    if (process.env.ALLOW_DEMO_MODE === 'true') {
        await demoSeedSetup(config);
    }
}

export default globalSetup;
