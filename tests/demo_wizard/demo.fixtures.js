/**
 * demo.fixtures.js — Shared test utilities for all demo_wizard spec files.
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
 * REFACTORED (2026-06-25):
 *   Persona constants, environment config, and SEED IDs are now imported from
 *   tests/fixtures/personas.js (single source of truth). This file re-exports
 *   them for backward compatibility — existing spec imports remain unchanged.
 *
 * AUDIT: 2026-06-17 — 3 critical + 2 stability issues patched (see previous commit).
 * PATCH: 2026-06-17 — SEED constants aligned with 00_seed.setup.js actual written IDs.
 */

import { expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Re-export persona constants, env config, and SEED IDs from the unified
// personas module. All spec files that import from demo.fixtures.js continue
// to work without changes.
// ---------------------------------------------------------------------------

export {
  BASE_URL,
  API_BASE_URL,
  DEMO_TOKEN,
  DEMO_SUPERADMIN,
  DEMO_ADMIN,
  DEMO_RETAILER,
  DEMO_BRAND,
  DEMO_ADVERTISER,
  DEMO_TECHOP,
  SEED,
} from '../fixtures/personas.js';

// Import locally for use in loginAs/authReset below
import { BASE_URL, DEMO_TOKEN } from '../fixtures/personas.js';

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
    localStorage.removeItem('auth_token');
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
    ({ role, token, personaObj }) => {
      localStorage.setItem('demo_role', role);
      localStorage.setItem('active_persona', role);
      localStorage.setItem('authToken', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify({
          id: personaObj.id,
          name: personaObj.displayName,
          email: personaObj.email,
          role: personaObj.role,
          linked_entity_id: personaObj.linkedEntityId || `entity-${role}`
      }));
    },
    { role: persona.role, token: DEMO_TOKEN, personaObj: persona },
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
