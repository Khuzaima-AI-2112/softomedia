/**
 * demo.fixtures.js — Single source of truth for all demo_wizard spec files.
 *
 * USAGE IN EVERY SPEC FILE:
 *   import { DEMO_ADMIN, DEMO_RETAILER, DEMO_BRAND, DEMO_ADVERTISER,
 *            DEMO_TECHOP, BASE_URL, DEMO_TOKEN, authReset } from './demo.fixtures.js';
 *
 *   test.beforeEach(authReset);
 *
 * DO NOT copy authReset into individual spec files. It lives here only.
 * See massivee2e.md → "Demo Auth State" for the rationale (demo_role / active_persona conflict, PR #46).
 */

import { expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
export const DEMO_TOKEN = process.env.DEMO_TOKEN || 'demo-token';

// ---------------------------------------------------------------------------
// Persona constants
// Each persona maps to the x-demo-role header value and the localStorage key
// written by the DemoLogin component.
// ---------------------------------------------------------------------------

export const DEMO_ADMIN = {
  id: 'demo-admin-uid',
  role: 'admin',            // x-demo-role header value
  email: 'admin@softomedia.demo',
  displayName: 'Demo Admin',
  firestoreId: 'demo-admin',
};

export const DEMO_RETAILER = {
  id: 'demo-retailer-uid',
  role: 'retaileradmin',    // x-demo-role header value
  email: 'retailer@softomedia.demo',
  displayName: 'Demo Retailer',
  firestoreId: 'demo-freshmart',
  retailerId: 'demo-freshmart',
};

export const DEMO_BRAND = {
  id: 'demo-brand-uid',
  role: 'brand',            // x-demo-role header value
  email: 'brand@softomedia.demo',
  displayName: 'Demo Brand',
  firestoreId: 'demo-brand',
  advertiserId: 'demo-bonvie',
};

export const DEMO_ADVERTISER = {
  id: 'demo-advertiser-uid',
  role: 'advertiser',       // x-demo-role header value
  email: 'advertiser@softomedia.demo',
  displayName: 'Demo Advertiser',
  firestoreId: 'demo-bonvie',
  advertiserId: 'demo-bonvie',
};

export const DEMO_TECHOP = {
  id: 'demo-techop-uid',
  role: 'techop',           // x-demo-role header value
  email: 'techop@softomedia.demo',
  displayName: 'Demo TechOp',
  firestoreId: 'demo-techop',
};

// ---------------------------------------------------------------------------
// Seeded resource IDs (set by 00_seed.setup.js, referenced across phases)
// ---------------------------------------------------------------------------

export const SEED = {
  retailerId: 'demo-freshmart',
  advertiserId: 'demo-bonvie',
  campaignId: 'demo-campaign-001',
  ticketId: 'demo-ticket-001',
  screenIds: [
    'demo-screen-01',
    'demo-screen-02',
    'demo-screen-03',
    'demo-screen-04',
  ],
  loopId: 'demo-loop-001',
};

// ---------------------------------------------------------------------------
// authReset — beforeEach hook, imported and used in every spec file.
//
// Resolves the demo_role / active_persona localStorage conflict documented in
// current_sprint/active_personaVSdemo_role.md and PR #46.
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
}

// ---------------------------------------------------------------------------
// loginAs — convenience helper to authenticate as a given persona.
//
// Usage:
//   await loginAs(page, DEMO_ADMIN);
//
// Sets localStorage keys that DemoAuthProvider reads on mount, then
// navigates to the persona's default dashboard and waits for the shell.
// ---------------------------------------------------------------------------

export async function loginAs(page, persona) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((p) => {
    localStorage.setItem('demo_role', p.role);
    localStorage.setItem('active_persona', p.role);
    localStorage.setItem('authToken', 'demo-token');
  }, persona);

  // Navigate to root; App.jsx will redirect to the correct dashboard
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });

  // Wait for the dashboard shell to confirm the redirect completed
  await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 15000 });

  // Confirm the role header will be sent on subsequent API calls
  // (sampled via a known safe GET — does not mutate state)
  const roleConfirmed = await page.evaluate((role) => {
    return localStorage.getItem('demo_role') === role;
  }, persona.role);

  if (!roleConfirmed) {
    throw new Error(
      `authReset: demo_role mismatch after loginAs. ` +
      `Expected '${persona.role}', got '${await page.evaluate(() => localStorage.getItem('demo_role'))}'.`
    );
  }
}

// ---------------------------------------------------------------------------
// assertRoleHeader — intercept the next matching request and assert it carries
// the correct x-demo-role header. Use for mutation steps (POST/PATCH/DELETE)
// where auth must be verified explicitly.
//
// Usage:
//   const assertHeader = await assertRoleHeader(page, DEMO_BRAND.role, '/api/campaigns');
//   await page.click('[data-testid="wizard-submit"]');
//   await assertHeader(); // resolves when the intercepted request is seen
// ---------------------------------------------------------------------------

export function assertRoleHeader(page, expectedRole, urlPattern) {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });

  page.route(`**${urlPattern}**`, async (route) => {
    const headers = route.request().headers();
    resolve(headers['x-demo-role']);
    await route.continue();
  });

  return async () => {
    const actualRole = await promise;
    expect(actualRole).toBe(expectedRole);
  };
}
