/**
 * tests/fixtures/seed-health.js
 *
 * Reusable seed health verification utility.
 *
 * Confirms that all seeded entities actually exist in the database by making
 * GET requests to the ad-server REST API. Call from any spec's test.beforeAll()
 * to fail fast if the seed is broken — instead of letting 50+ tests time out
 * waiting for UI elements that will never render.
 *
 * USAGE:
 *   import { verifySeedHealth } from '../fixtures/seed-health.js';
 *
 *   test.beforeAll(async () => {
 *     await verifySeedHealth();
 *   });
 *
 * DESIGN RATIONALE:
 *   The 61-test cascade in the 2026-06-24 SRE report was caused by a silent
 *   seed failure. This module provides an explicit health gate that converts
 *   silent downstream failures into a single loud error at suite startup.
 */

import { SEED, API_BASE_URL, DEMO_TOKEN } from './personas.js';

/**
 * Verify that all seed entities exist by making GET requests.
 *
 * @param {object} [options]
 * @param {string} [options.apiBase] — override API base URL
 * @param {string} [options.token] — override auth token
 * @param {boolean} [options.verbose] — log each check to console
 * @throws {Error} If any seed entity is missing
 */
export async function verifySeedHealth(options = {}) {
  const apiBase = options.apiBase ?? API_BASE_URL;
  const token = options.token ?? DEMO_TOKEN;
  const verbose = options.verbose ?? true;

  const targets = [
    { label: 'Retailer',    path: `/api/retailers/${SEED.retailerId}` },
    { label: 'Advertiser',  path: `/api/advertisers/${SEED.advertiserId}` },
    { label: 'Campaign',    path: `/api/campaigns/${SEED.campaignId}` },
    { label: 'Loop',        path: `/api/loops/${SEED.loopId}` },
  ];

  const failures = [];

  for (const target of targets) {
    try {
      const res = await fetch(`${apiBase}${target.path}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-demo-role': 'superadmin',
        },
      });

      if (res.ok) {
        if (verbose) console.log(`[seed-health] ✓ ${target.label} (${target.path})`);
      } else {
        const msg = `${target.label}: GET ${target.path} → ${res.status}`;
        failures.push(msg);
        if (verbose) console.error(`[seed-health] ✗ ${msg}`);
      }
    } catch (err) {
      const msg = `${target.label}: GET ${target.path} → fetch error: ${err.message}`;
      failures.push(msg);
      if (verbose) console.error(`[seed-health] ✗ ${msg}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `[seed-health] Seed verification failed. ${failures.length} of ${targets.length} ` +
      `entities missing or unreachable.\n\n` +
      `Failures:\n${failures.map(f => `  - ${f}`).join('\n')}\n\n` +
      `Check that:\n` +
      `  1. ad-server is running at ${apiBase}\n` +
      `  2. ALLOW_DEMO_MODE=true is set\n` +
      `  3. 00_seed.setup.js completed without silent errors\n` +
      `  4. Seed entity IDs in fixtures/personas.js match 00_seed.setup.js`
    );
  }

  if (verbose) {
    console.log(`[seed-health] All ${targets.length} seed entities verified.`);
  }
}
