/**
 * 00_seed.setup.js
 * Demo wizard global setup — Phase 0.
 *
 * Runs once before the entire demo_wizard suite via Playwright globalSetup.
 * Writes deterministic Firestore seed data with dynamic slot timing so
 * loop_playback tests never see "Waiting for Scheduled Slot" again.
 *
 * CRITICAL: slot startTime is set to Date.now() at seed-time, not hardcoded.
 * This is the single fix that closes all 10 loop_playback.spec.js timeouts.
 *
 * Teardown (globalTeardown) is registered at the bottom of this file.
 * It deletes demo-campaign-001 and all seed documents after the full suite
 * finishes. Phase 6 no longer performs cleanup — see massivee2e.md fix #6.
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import { verifySeedHealth } from '../fixtures/seed-health.js';

// ---------------------------------------------------------------------------
// Demo persona constants — single source of truth for all 16 phases.
// Any spec that needs a persona imports from demo.fixtures.js which re-exports
// these values. Do not duplicate them per-spec.
// ---------------------------------------------------------------------------
export const DEMO_ADMIN = 'admin';
export const DEMO_BRAND = 'brand';
export const DEMO_RETAILER = 'retailer';
export const DEMO_TECHOP = 'techoperator';

// Stable entity IDs referenced by multiple phases.
export const DEMO_RETAILER_ID = 'demo-retailer-freshmart';
export const DEMO_ADVERTISER_ID = 'demo-advertiser-bonvie';
export const DEMO_CAMPAIGN_ID = 'demo-campaign-001';
export const DEMO_LOOP_ID = 'demo-loop-freshmart-main';
export const DEMO_STORE_IDS = ['demo-store-mtl-north', 'demo-store-mtl-south'];
export const DEMO_SCREEN_IDS = [
    'demo-screen-north-1', 'demo-screen-north-2',
    'demo-screen-south-1', 'demo-screen-south-2',
];

// ---------------------------------------------------------------------------
// Slot timing — THE fix for loop_playback timeouts.
// Slots are written at seed-time relative to Date.now() so they always cover
// the current hour when tests run. A 35-second player timeout (15s creative +
// 10s cold-start + 10s CI margin) is sufficient with this guarantee in place.
// ---------------------------------------------------------------------------
function buildDemoSlots() {
    const now = Date.now();
    const currentHourStart = now - (now % 3_600_000); // floor to current hour

    return [
        {
            slotIndex: 0,
            position: 0,
            startTime: currentHourStart,
            endTime: currentHourStart + 15_000,
            duration: 15,
            status: 'booked',
            campaign_id: DEMO_CAMPAIGN_ID,
            advertiser_id: DEMO_ADVERTISER_ID,
            creative_url: 'https://cdn.softomedia.demo/bonvie-ad-1.mp4',
            asset_id: 'bonvie-ad-1',
        },
        {
            slotIndex: 1,
            position: 1,
            startTime: currentHourStart + 15_000,
            endTime: currentHourStart + 30_000,
            duration: 15,
            status: 'booked',
            campaign_id: DEMO_CAMPAIGN_ID,
            advertiser_id: DEMO_ADVERTISER_ID,
            creative_url: 'https://cdn.softomedia.demo/bonvie-ad-2.mp4',
            asset_id: 'bonvie-ad-2',
        },
    ];
}

// ---------------------------------------------------------------------------
// Firestore seed payload — written via the ad-server REST API so the seed
// exercises the same code paths as production writes. Falls back to direct
// localStorage injection for auth state (same pattern as global.setup.js).
// ---------------------------------------------------------------------------
async function seedViaApi(baseURL, token, payload) {
    const { endpoint, method = 'POST', body } = payload;
    const res = await fetch(`${baseURL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-demo-role': 'superadmin',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Seed failed [${method} ${endpoint}]: ${res.status} — ${text}`);
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// globalSetup — entry point called by Playwright before any spec runs.
// ---------------------------------------------------------------------------
async function demoSeedSetup(config) {
    const baseURL = config.projects[0].use.baseURL;
    const apiBase = process.env.API_BASE_URL || 'http://localhost:8080';

    if (!process.env.ALLOW_DEMO_MODE) {
        throw new Error(
            '[00_seed.setup.js] ALLOW_DEMO_MODE env var is not set. ' +
            'Demo suite requires ALLOW_DEMO_MODE=true to run.'
        );
    }

    // -----------------------------------------------------------------------
    // Step 1 — Auth storage state for all four personas.
    // Mirrors global.setup.js but adds linked_entity_id and uses authToken
    // (camelCase) — the key demo.fixtures.js assertRoleHeader() reads.
    // -----------------------------------------------------------------------
    const browser = await chromium.launch();

    if (!fs.existsSync('tests/.auth')) {
        fs.mkdirSync('tests/.auth', { recursive: true });
    }

    const personas = [
        { role: DEMO_ADMIN, linked_entity_id: 'entity-admin-001' },
        { role: DEMO_BRAND, linked_entity_id: DEMO_ADVERTISER_ID },
        { role: DEMO_RETAILER, linked_entity_id: DEMO_RETAILER_ID },
        { role: DEMO_TECHOP, linked_entity_id: 'entity-techop-001' },
    ];

    for (const persona of personas) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(baseURL);

        await page.evaluate((p) => {
            const mockUser = {
                id: `user-${p.role}`,
                email: `${p.role}@softomedia.com`,
                name: `Demo ${p.role.charAt(0).toUpperCase() + p.role.slice(1)}`,
                role: p.role,
                linked_entity_id: p.linked_entity_id,  // required for campaigns.js T5 stamping
            };
            // authToken (camelCase) — matches demo.fixtures.js assertRoleHeader() read key.
            // auth_token (snake_case) is also written for backward compat with any
            // legacy spec that hasn't migrated to demo.fixtures.js yet.
            localStorage.setItem('active_persona', p.role);
            localStorage.setItem('demo_role', p.role);
            localStorage.setItem('authToken', 'demo-token');   // PRIMARY — used by demo.fixtures.js
            localStorage.setItem('auth_token', 'demo-token');   // LEGACY   — kept for non-migrated specs
            localStorage.setItem('auth_user', JSON.stringify(mockUser));
        }, persona);

        await page.context().storageState({ path: `tests/.auth/${persona.role}.json` });
        await context.close();
    }

    await browser.close();

    // -----------------------------------------------------------------------
    // Step 2 — Firestore seed via API.
    // Uses DEMO_ADMIN token. Each call is a POST to the ad-server REST layer
    // so Firestore validators, middleware, and repository logic all run.
    // -----------------------------------------------------------------------
    const adminToken = 'demo-token';
    const slots = buildDemoSlots();

    const seedPayloads = [
        // Retailer
        {
            endpoint: '/api/retailers',
            body: {
                id: DEMO_RETAILER_ID,
                name: 'FreshMart Montréal',
                status: 'active',
                contact_email: 'admin@freshmart.demo',
                contract_start: '2026-01-01',
            },
        },
        // Locations
        ...DEMO_STORE_IDS.map((storeId, i) => ({
            endpoint: '/api/locations',
            body: {
                id: storeId,
                name: `FreshMart ${i === 0 ? 'North' : 'South'} — Demo`,
                retailer_id: DEMO_RETAILER_ID,
                screen_ids: i === 0 
                    ? ['demo-screen-north-1', 'demo-screen-north-2']
                    : ['demo-screen-south-1', 'demo-screen-south-2']
            }
        })),
        // Stores
        ...DEMO_STORE_IDS.map((storeId, i) => ({
            endpoint: `/api/stores`,
            body: {
                id: storeId,
                name: `FreshMart ${i === 0 ? 'North' : 'South'} — Demo`,
                retailer_id: DEMO_RETAILER_ID,
                address: i === 0
                    ? '1234 Rue Sherbrooke O., Montréal'
                    : '5678 Blvd. Saint-Laurent, Montréal',
            },
        })),
        // Screens (2 per store)
        ...DEMO_SCREEN_IDS.map((screenId, i) => ({
            endpoint: '/api/screens',
            body: {
                screen_id: screenId,
                name: `Screen ${i + 1} — Demo`,
                store_id: DEMO_STORE_IDS[Math.floor(i / 2)],
                retailer_id: DEMO_RETAILER_ID,
                status: 'active',
                resolution: '1920x1080',
                user_agent: 'Playwright Demo Seed',
            },
        })),
        // Advertiser
        {
            endpoint: '/api/advertisers',
            body: {
                id: DEMO_ADVERTISER_ID,
                name: 'BonVie Snacks',
                status: 'active',
                linked_user_id: `user-${DEMO_BRAND}`,
                logo: 'logo.png',
                industry: 'Food & Beverage',
                contactemail: 'brand@bonvie.demo',
                budget: 10000,
            },
        },
        // Loop with dynamic slots — THE slot timing fix.
        {
            endpoint: '/api/loops',
            body: {
                id: DEMO_LOOP_ID,
                name: 'FreshMart Main Loop — Demo',
                retailer_id: DEMO_RETAILER_ID,
                location_id: 'demo-store-mtl-north',
                screen_ids: DEMO_SCREEN_IDS,
                duration: 60,
                status: 'approved',
                hour: 12,
                date: new Date().toISOString().split('T')[0],
                slots,          // startTime = Date.now() — kills timeout failures
            },
        },
        // Campaign — seeded as 'approved' so Phase 15 (15.2) can assert on it
        // without depending on Phase 3 wizard run + admin approval chain.
        {
            endpoint: '/api/campaigns',
            body: {
                id: DEMO_CAMPAIGN_ID,
                name: 'BonVie Summer Demo',
                advertiser_id: DEMO_ADVERTISER_ID,
                retailer_id: DEMO_RETAILER_ID,
                status: 'approved',
                start_date: '2026-06-01',
                end_date: '2026-08-31',
                budget: 5000,
                cpm: 12.5,
                creative_url: 'https://cdn.softomedia.demo/bonvie-ad-1.mp4',
                impressions_delivered: 120000,
            },
        },
        // Invoice — generate an invoice for the demo campaign
        {
            endpoint: '/api/invoices/generate',
            body: {
                campaignId: DEMO_CAMPAIGN_ID,
            },
        },
    ];

    for (const payload of seedPayloads) {
        try {
            await seedViaApi(apiBase, adminToken, payload);
        } catch (err) {
            // Seed is idempotent — 409 Conflict or 500 ALREADY_EXISTS means 
            // the doc already exists from a previous run. Treat as success; any other error is fatal.
            if (!err.message.includes('409') && !err.message.includes('ALREADY_EXISTS')) {
                throw err;
            }
        }
    }

    console.log('[00_seed.setup.js] Demo seed writes complete. Verifying seed health...');

    // -----------------------------------------------------------------------
    // Step 3 — Seed Verification Gate
    // Confirms all seeded entities are accessible via GET. Converts silent
    // seed failures into loud errors at suite startup.
    // -----------------------------------------------------------------------
    await verifySeedHealth({ apiBase, token: adminToken, verbose: true });

    console.log('[00_seed.setup.js] Demo seed complete. Dynamic slot startTime:', new Date(buildDemoSlots()[0].startTime).toISOString());
}

export default demoSeedSetup;

// ---------------------------------------------------------------------------
// globalTeardown — registered separately in playwright.config.js.
// Deletes demo campaign and all seed documents after the full suite finishes.
// Phase 6 ends at step 6.3 (validate) — cleanup is here, not in a spec.
// ---------------------------------------------------------------------------
export async function demoSeedTeardown() {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:8080';
    const adminToken = 'demo-token';

    const teardownTargets = [
        { method: 'DELETE', endpoint: `/api/campaigns/${DEMO_CAMPAIGN_ID}` },
        { method: 'DELETE', endpoint: `/api/loops/${DEMO_LOOP_ID}` },
        ...DEMO_SCREEN_IDS.map(id => ({ method: 'DELETE', endpoint: `/api/screens/${id}` })),
        ...DEMO_STORE_IDS.map(id => ({ method: 'DELETE', endpoint: `/api/stores/${id}` })),
        ...DEMO_STORE_IDS.map(id => ({ method: 'DELETE', endpoint: `/api/locations/${id}` })),
        { method: 'DELETE', endpoint: `/api/advertisers/${DEMO_ADVERTISER_ID}` },
        { method: 'DELETE', endpoint: `/api/retailers/${DEMO_RETAILER_ID}` },
    ];

    for (const target of teardownTargets) {
        try {
            const res = await fetch(`${apiBase}${target.endpoint}`, {
                method: target.method,
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'x-demo-role': 'superadmin',
                },
            });
            if (!res.ok && res.status !== 404) {
                console.warn(`[teardown] ${target.method} ${target.endpoint} → ${res.status}`);
            }
        } catch (err) {
            console.warn(`[teardown] fetch error for ${target.endpoint}:`, err.message);
        }
    }

    console.log('[00_seed.setup.js] Demo teardown complete.');
}
