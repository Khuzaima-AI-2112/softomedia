/**
 * demo.fixtures.js — Single source of truth for all demo_wizard spec files.
 *
 * USAGE IN EVERY SPEC FILE:
 *   import { DEMO_ADMIN, DEMO_RETAILER, DEMO_BRAND, DEMO_ADVERTISER,
 *            DEMO_TECHOP, BASE_URL, DEMO_TOKEN, authReset, loginAs,
 *            assertRoleHeader, SEED } from './demo.fixtures.js';
 *
 *   test.beforeEach(authReset);
 *
 * DO NOT copy authReset or loginAs into individual spec files. They live here only.
 * See massivee2e.md → "Demo Auth State" for the rationale (demo_role / active_persona
 * conflict, PR #46).
 *
 * AUDIT: 2026-06-17 — 3 critical + 2 stability issues patched (see previous commit).
 * PATCH: 2026-06-17 — SEED constants aligned with 00_seed.setup.js actual written IDs.
 *   All 5 ID mismatches corrected; storeIds export added; API_BASE_URL default fixed.
 */

import { expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export const BASE_URL     = process.env.BASE_URL     || 'http://localhost:3000';
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'; // FIX: was 8080

/**
 * DEMO_TOKEN is the single token constant used everywhere in this file.
 * Previously, loginAs() had a hardcoded 'demo-token' string that diverged
 * from this constant when DEMO_TOKEN env var was set. Now fixed.
 */
export const DEMO_TOKEN = process.env.DEMO_TOKEN || 'demo-token';

// ---------------------------------------------------------------------------
// Persona constants
// Each persona maps to the x-demo-role header value and the localStorage key
// written by the DemoLogin component.
// ---------------------------------------------------------------------------

export const DEMO_ADMIN = {
  id:          'demo-admin-uid',
  role:        'admin',            // x-demo-role header value
  email:       'admin@softomedia.demo',
  displayName: 'Demo Admin',
  firestoreId: 'demo-admin',
};

export const DEMO_RETAILER = {
  id:          'demo-retailer-uid',
  role:        'retaileradmin',    // x-demo-role header value
  email:       'retailer@softomedia.demo',
  displayName: 'Demo Retailer',
  firestoreId: 'demo-retailer-freshmart',
  retailerId:  'demo-retailer-freshmart', // FIX: was 'demo-freshmart'
};

/**
 * INTENTIONAL: DEMO_BRAND and DEMO_ADVERTISER share advertiserId.
 * They represent the same company (BonVie Snacks) with different system access roles.
 * Do NOT change one without the other — cross-persona assertions in Phases 11–13
 * depend on this alignment.
 */
export const DEMO_BRAND = {
  id:           'demo-brand-uid',
  role:         'brand',            // x-demo-role header value
  email:        'brand@softomedia.demo',
  displayName:  'Demo Brand',
  firestoreId:  'demo-brand',
  advertiserId: 'demo-advertiser-bonvie', // FIX: was 'demo-bonvie'
};

export const DEMO_ADVERTISER = {
  id:           'demo-advertiser-uid',
  role:         'advertiser',       // x-demo-role header value
  email:        'advertiser@softomedia.demo',
  displayName:  'Demo Advertiser',
  firestoreId:  'demo-advertiser-bonvie',  // FIX: was 'demo-bonvie'
  advertiserId: 'demo-advertiser-bonvie',  // INTENTIONAL: same as DEMO_BRAND (see note above)
};

export const DEMO_TECHOP = {
  id:          'demo-techop-uid',
  role:        'techop',           // x-demo-role header value
  email:       'techop@softomedia.demo',
  displayName: 'Demo TechOp',
  firestoreId: 'demo-techop',
};

// ---------------------------------------------------------------------------
// Seeded resource IDs
// These MUST exactly match the IDs written by 00_seed.setup.js.
// When 00_seed.setup.js changes an ID, update it here first, then update
// any spec that references SEED.<field> — do not patch specs directly.
//
// Canonical source: 00_seed.setup.js exports
//   DEMO_RETAILER_ID   = 'demo-retailer-freshmart'
//   DEMO_ADVERTISER_ID = 'demo-advertiser-bonvie'
//   DEMO_CAMPAIGN_ID   = 'demo-campaign-001'
//   DEMO_LOOP_ID       = 'demo-loop-freshmart-main'
//   DEMO_STORE_IDS     = ['demo-store-mtl-north', 'demo-store-mtl-south']
//   DEMO_SCREEN_IDS    = ['demo-screen-north-1', 'demo-screen-north-2',
//                         'demo-screen-south-1', 'demo-screen-south-2']
// ---------------------------------------------------------------------------

export const SEED = {
  retailerId:   'demo-retailer-freshmart',    // FIX: was 'demo-freshmart'
  advertiserId: 'demo-advertiser-bonvie',     // FIX: was 'demo-bonvie'
  campaignId:   'demo-campaign-001',          // unchanged
  ticketId:     'demo-ticket-001',            // unchanged
  loopId:       'demo-loop-freshmart-main',   // FIX: was 'demo-loop-001'

  // FIX: was ['demo-screen-01'..'04']
  screenIds: [
    'demo-screen-north-1',
    'demo-screen-north-2',
    'demo-screen-south-1',
    'demo-screen-south-2',
  ],

  // NEW: store IDs were not exported before; specs in Phase 1 need them
  storeIds: [
    'demo-store-mtl-north',
    'demo-store-mtl-south',
  ],
};

// ---------------------------------------------------------------------------
// authReset — beforeEach hook, imported and used in every spec file.
//
// Resolves the demo_role / active_persona localStorage conflict documented in
// current_sprint/active_personaVSdemo_role.md and PR #46.
//
// FIX (2026-06-17): Added page.reload() after clearing localStorage.
// Previously, clearing storage did not flush React's in-memory auth state
// (DemoAuthProvider holds auth in a Context ref). Without the reload, tests
// that called authReset() and then immediately read UI auth state could see
// the previous persona still mounted. The reload forces a clean provider init.
//
// Pattern:
//   test.beforeEach(authReset);
// ---------------------------------------------------------------------------

export async function authReset({ page }) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('demo_role');
    localStorage.removeItem('active_persona');
    localStorage.removeItem('authToken');
    sessionStorage.clear();
  });
  // Reload to flush React in-memory auth state held by DemoAuthProvider.
  await page.reload({ waitUntil: 'domcontentloaded' });
}

// ---------------------------------------------------------------------------
// loginAs — convenience helper to authenticate as a given persona.
//
// Usage:
//   await loginAs(page, DEMO_ADMIN);
//
// Sets localStorage keys that DemoAuthProvider reads on mount, then
// navigates to root (App.jsx redirects to the correct dashboard) and waits
// for the dashboard shell selector.
//
// FIXES (2026-06-17):
// 1. Token: uses DEMO_TOKEN constant, not a hardcoded 'demo-token' string.
// 2. waitUntil: 'domcontentloaded' — 'networkidle' hangs on SPA polling.
// 3. Error message: actualRole resolved before throw (was '[object Promise]').
// ---------------------------------------------------------------------------

export async function loginAs(page, persona) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ role, token }) => {
      localStorage.setItem('demo_role',      role);
      localStorage.setItem('active_persona', role);
      localStorage.setItem('authToken',      token);
    },
    { role: persona.role, token: DEMO_TOKEN },
  );

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 15000 });

  const actualRole = await page.evaluate(() => localStorage.getItem('demo_role'));

  if (actualRole !== persona.role) {
    throw new Error(
      `loginAs: demo_role mismatch after authentication. ` +
      `Expected '${persona.role}', got '${actualRole}'. ` +
      `Check DemoAuthProvider mount order and localStorage key names.`,
    );
  }
}

// ---------------------------------------------------------------------------
// assertRoleHeader — intercept the next matching request and assert it carries
// the correct x-demo-role header. Use for mutation steps (POST/PATCH/DELETE).
//
// Usage:
//   const assertHeader = await assertRoleHeader(page, DEMO_BRAND.role, '/api/campaigns');
//   await page.click('[data-testid="wizard-submit"]');
//   await assertHeader();
//
// FIXES (2026-06-17):
// 1. 10s timeout via Promise.race() — no longer hangs test on missing request.
// 2. page.unroute() on resolve — no stale handler accumulation across steps.
// ---------------------------------------------------------------------------

export function assertRoleHeader(page, expectedRole, urlPattern) {
  let resolveCapture;

  const capturePromise = new Promise((res) => {
    resolveCapture = res;
  });

  const handler = async (route) => {
    const headers = route.request().headers();
    resolveCapture(headers['x-demo-role']);
    await route.continue();
  };

  page.route(`**${urlPattern}**`, handler);

  const TIMEOUT_MS = 10_000;

  return async () => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `assertRoleHeader: no request matching '${urlPattern}' intercepted ` +
              `within ${TIMEOUT_MS}ms. Check URL pattern and that the action ` +
              `triggering the request was performed after setup.`,
            ),
          ),
        TIMEOUT_MS,
      ),
    );

    let actualRole;
    try {
      actualRole = await Promise.race([capturePromise, timeoutPromise]);
    } finally {
      await page.unroute(`**${urlPattern}**`, handler);
    }

    expect(actualRole).toBe(expectedRole);
  };
}
