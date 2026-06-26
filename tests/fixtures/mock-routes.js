/**
 * tests/fixtures/mock-routes.js
 *
 * Shared Playwright page.route() helpers that mock API endpoints using the
 * factory functions from factories.js.
 *
 * DESIGN PRINCIPLES:
 *   1. Each helper mocks a single API endpoint pattern.
 *   2. Callers can pass factory overrides or custom data.
 *   3. Default responses return valid, schema-compliant data.
 *   4. All helpers follow the same signature: (page, customData?) => Promise<void>
 *
 * USAGE:
 *   import { mockLoopsApi, mockAnalyticsApi } from '../fixtures/mock-routes.js';
 *
 *   test.beforeEach(async ({ page }) => {
 *     await mockLoopsApi(page);
 *     await mockAnalyticsApi(page);
 *   });
 *
 *   // Or with custom data:
 *   await mockLoopsApi(page, { loops: [buildLoop({ status: 'pending_approval' })] });
 *
 * ADDING A NEW MOCK:
 *   1. Add a factory function in factories.js (if needed).
 *   2. Add a mock-route helper below following the same pattern.
 *   3. Update any specs that inline the same route mock.
 */

import {
  buildLoop,
  buildBusinessHoursLoops,
  buildCampaign,
  buildPlaylist,
  buildAnalyticsSummary,
  buildAdminStats,
} from './factories.js';

// ---------------------------------------------------------------------------
// Response helper — builds a route.fulfill() options object
// ---------------------------------------------------------------------------

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

// ---------------------------------------------------------------------------
// API Mock Helpers
// ---------------------------------------------------------------------------

/**
 * Mock GET /api/loops and /api/loops?date=...
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {object[]} [options.loops] — custom loop array (default: business hours set)
 * @param {object} [options.business_hours] — { start, end }
 */
export async function mockLoopsApi(page, options = {}) {
  const loops = options.loops ?? buildBusinessHoursLoops();
  const business_hours = options.business_hours ?? { start: 8, end: 22 };

  await page.route('**/api/loops**', route => {
    route.fulfill(jsonResponse({ loops, business_hours }));
  });
}

/**
 * Mock POST /api/loops/generate
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {object[]} [options.loops] — custom loop array
 */
export async function mockLoopGenerateApi(page, options = {}) {
  const loops = options.loops ?? buildBusinessHoursLoops({ status: 'pending_approval' });

  await page.route('**/api/loops/generate', route => {
    route.fulfill(jsonResponse({
      message: `Generated ${loops.length} loops`,
      loops,
    }, 201));
  });
}

/**
 * Mock GET /api/loops/:id (single loop fetch)
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [loop] — custom loop object (default: single loop for current hour)
 */
export async function mockSingleLoopApi(page, loop) {
  const data = loop ?? buildLoop();

  await page.route(`**/api/loops/${data.id}`, route => {
    route.fulfill(jsonResponse(data));
  });
}

/**
 * Mock PATCH /api/loops/:id/approve
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mockLoopApproveApi(page) {
  await page.route('**/api/loops/**/approve', route => {
    route.fulfill(jsonResponse({ status: 'approved' }));
  });
}

/**
 * Mock GET /api/analytics/loops** and GET /api/analytics**
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [summary] — custom analytics summary
 */
export async function mockAnalyticsApi(page, summary) {
  const data = summary ?? buildAnalyticsSummary();

  await page.route('**/api/analytics/loops**', route => {
    // UI expects an array for loops
    route.fulfill(jsonResponse(data.hourly));
  });
  
  await page.route('**/api/analytics/summary**', route => {
    route.fulfill(jsonResponse(data));
  });
}

/**
 * Mock GET /api/playlist/**
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [playlist] — custom playlist object
 */
export async function mockPlaylistApi(page, playlist) {
  const data = playlist ?? buildPlaylist();

  await page.route('**/api/playlist/**', route => {
    route.fulfill(jsonResponse(data));
  });
}

/**
 * Mock POST /api/screens/register
 *
 * @param {import('@playwright/test').Page} page
 * @param {boolean} [shouldFail] — if true, returns 500
 */
export async function mockScreenRegisterApi(page, shouldFail = false) {
  await page.route('**/api/screens/register', route => {
    if (shouldFail) {
      route.fulfill({ status: 500 });
    } else {
      route.fulfill(jsonResponse({ success: true }));
    }
  });
}

/**
 * Mock GET /api/monitoring/heartbeat
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mockHeartbeatApi(page) {
  await page.route('**/api/monitoring/heartbeat', route => {
    route.fulfill({ status: 200 });
  });
}

/**
 * Mock POST /api/telemetry/**
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mockTelemetryApi(page) {
  await page.route('**/api/telemetry/**', route => {
    route.fulfill({ status: 200 });
  });
}

/**
 * Mock GET /api/admin/overview (admin dashboard stats)
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [stats] — custom admin stats
 */
export async function mockAdminOverviewApi(page, stats) {
  const data = stats ?? buildAdminStats();

  await page.route('**/api/admin/overview**', route => {
    route.fulfill(jsonResponse(data));
  });
}

/**
 * Apply a standard set of infrastructure mocks (heartbeat, telemetry, screen
 * register) that most E2E tests need to avoid timeout noise.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mockInfrastructureApis(page) {
  await mockScreenRegisterApi(page);
  await mockHeartbeatApi(page);
  await mockTelemetryApi(page);
}
