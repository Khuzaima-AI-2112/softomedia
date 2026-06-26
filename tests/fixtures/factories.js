/**
 * tests/fixtures/factories.js
 *
 * Test data factory functions that produce valid entity shapes matching the
 * current ad-server API response schema.
 *
 * DESIGN PRINCIPLES:
 *   1. Every factory returns a minimal valid entity with sane defaults.
 *   2. Callers pass an `overrides` object to customize specific fields.
 *   3. All enum values use lowercase (per DATABASE_SCHEMA.md § Canonical Enum Values).
 *   4. All field names use snake_case (the backend canonical format).
 *   5. IDs are deterministic by default but can be overridden for uniqueness.
 *
 * USAGE:
 *   import { buildLoop, buildCampaign } from '../fixtures/factories.js';
 *
 *   const loop = buildLoop({ status: 'pending_approval', hour: 14 });
 *   const campaign = buildCampaign({ name: 'Custom Name' });
 *
 * ADDING A NEW FACTORY:
 *   1. Define the factory function below following the same pattern.
 *   2. Export it from this file.
 *   3. If the entity has a route mock, add a corresponding helper in mock-routes.js.
 */

import { SEED } from './personas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0;
function nextId(prefix = 'test') {
  return `${prefix}-${++_counter}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function currentHourStart() {
  const now = Date.now();
  return now - (now % 3_600_000);
}

// ---------------------------------------------------------------------------
// Entity Factories
// ---------------------------------------------------------------------------

/**
 * Build a loop slot object.
 * @param {object} overrides
 * @returns {object} A valid slot shape
 */
export function buildSlot(overrides = {}) {
  const hourStart = currentHourStart();
  const position = overrides.position ?? 0;
  return {
    slotIndex: position,
    position,
    startTime: hourStart + (position * 15_000),
    endTime: hourStart + ((position + 1) * 15_000),
    duration: 15,
    status: 'booked',
    campaign_id: SEED.campaignId,
    advertiser_id: SEED.advertiserId,
    creative_url: `https://cdn.softomedia.demo/test-ad-${position}.mp4`,
    asset_id: `asset_${position}`,
    asset_name: `Test Ad ${position + 1}`,
    ...overrides,
  };
}

/**
 * Build a loop object with N slots.
 * @param {object} overrides — loop-level overrides
 * @param {number} slotCount — number of slots to generate (default 12)
 * @returns {object} A valid loop shape
 */
export function buildLoop(overrides = {}, slotCount = 12) {
  const date = overrides.date ?? todayISO();
  const hour = overrides.hour ?? new Date().getHours();
  const id = overrides.id ?? `${date}_${hour}_loc_downtown`;

  return {
    id,
    date,
    hour,
    status: 'approved',
    retailer_id: SEED.retailerId,
    screen_ids: SEED.screenIds,
    duration: 60,
    slots: Array.from({ length: slotCount }, (_, i) =>
      buildSlot({ position: i, ...overrides.slotOverrides }),
    ),
    ...overrides,
    // Ensure slotOverrides doesn't leak into the loop object
    slotOverrides: undefined,
  };
}

/**
 * Build a list of loops covering business hours (8am–10pm).
 * @param {object} overrides — applied to each loop
 * @returns {object[]} Array of loop objects
 */
export function buildBusinessHoursLoops(overrides = {}) {
  const date = overrides.date ?? todayISO();
  return Array.from({ length: 14 }, (_, i) => {
    const hour = 8 + i;
    return buildLoop({ date, hour, ...overrides });
  });
}

/**
 * Build a campaign object.
 * @param {object} overrides
 * @returns {object} A valid campaign shape
 */
export function buildCampaign(overrides = {}) {
  return {
    id: SEED.campaignId,
    name: 'BonVie Summer Demo',
    advertiser_id: SEED.advertiserId,
    retailer_id: SEED.retailerId,
    status: 'approved',
    start_date: '2026-06-01',
    end_date: '2026-08-31',
    budget: 5000,
    cpm: 12.5,
    creative_url: 'https://cdn.softomedia.demo/bonvie-ad-1.mp4',
    ...overrides,
  };
}

/**
 * Build a retailer object.
 * @param {object} overrides
 * @returns {object} A valid retailer shape
 */
export function buildRetailer(overrides = {}) {
  return {
    id: overrides.id ?? SEED.retailerId,
    name: 'FreshMart Montréal',
    status: 'active',
    contact_email: 'admin@freshmart.demo',
    contract_start: '2026-01-01',
    ...overrides,
  };
}

/**
 * Build a store object.
 * @param {object} overrides
 * @returns {object} A valid store shape
 */
export function buildStore(overrides = {}) {
  return {
    id: overrides.id ?? nextId('store'),
    name: 'FreshMart North — Demo',
    retailer_id: SEED.retailerId,
    address: '1234 Rue Sherbrooke O., Montréal',
    status: 'active',
    ...overrides,
  };
}

/**
 * Build a screen object.
 * @param {object} overrides
 * @returns {object} A valid screen shape
 */
export function buildScreen(overrides = {}) {
  return {
    screen_id: overrides.screen_id ?? nextId('screen'),
    name: 'Screen 1 — Demo',
    store_id: SEED.storeIds[0],
    retailer_id: SEED.retailerId,
    status: 'active',
    resolution: '1920x1080',
    orientation: 'landscape',
    user_agent: 'Playwright Test',
    ...overrides,
  };
}

/**
 * Build an advertiser object.
 * @param {object} overrides
 * @returns {object} A valid advertiser shape
 */
export function buildAdvertiser(overrides = {}) {
  return {
    id: overrides.id ?? SEED.advertiserId,
    name: 'BonVie Snacks',
    status: 'active',
    industry: 'Food & Beverage',
    contactemail: 'brand@bonvie.demo',
    budget: 10000,
    ...overrides,
  };
}

/**
 * Build a playlist object.
 * @param {object} overrides
 * @returns {object} A valid playlist shape
 */
export function buildPlaylist(overrides = {}) {
  return {
    playlist: [
      {
        id: 'fallback',
        url: 'https://placehold.co/1920x1080/gray/white?text=Fallback',
        title: 'Fallback',
        duration: 5,
      },
    ],
    source: 'global',
    ...overrides,
  };
}

/**
 * Build an analytics summary object.
 * @param {object} overrides
 * @returns {object} A valid analytics summary shape
 */
export function buildAnalyticsSummary(overrides = {}) {
  return {
    summary: {
      totalLoops: 154,
      avgIntegrityScore: 98.2,
      fullDeliveryCount: 12,
      partialCount: 2,
      ...overrides.summary,
    },
    hourly: overrides.hourly ?? Array.from({ length: 14 }, (_, i) => ({
      hour: 8 + i,
      loopCompletions: 11,
      integrityScore: 98.2,
      status: 'DELIVERED',
    })),
    business_hours: {
      start: 8,
      end: 22,
      ...overrides.business_hours,
    },
  };
}

/**
 * Build an admin overview stats object.
 * @param {object} overrides
 * @returns {object} A valid admin stats shape
 */
export function buildAdminStats(overrides = {}) {
  return {
    retailers: 4,
    advertisers: 3,
    activeScreens: 12,
    totalScreens: 15,
    pendingLoops: 2,
    totalUsers: 8,
    ...overrides,
  };
}

/**
 * Build pricing configuration.
 * @param {object} overrides
 * @returns {object} A valid pricing config shape
 */
export function buildPricing(overrides = {}) {
  return {
    base_cpm: 15.00,
    traffic_tiers: {
      very_low:  { multiplier: 0.5,  label: 'Very Low',  color: '#94a3b8', hours: [8, 9, 20, 21] },
      low:       { multiplier: 0.75, label: 'Low',       color: '#60a5fa', hours: [10, 11, 19] },
      medium:    { multiplier: 1.0,  label: 'Medium',    color: '#fbbf24', hours: [14, 15, 16] },
      high:      { multiplier: 1.5,  label: 'High',      color: '#22c55e', hours: [12, 13, 17, 18] },
    },
    ...overrides,
  };
}
