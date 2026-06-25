/**
 * tests/fixtures/personas.js
 *
 * SINGLE SOURCE OF TRUTH for all test persona definitions.
 *
 * This module is consumed by:
 *   - tests/global.setup.js          → creates storageState auth files
 *   - tests/base.fixtures.js         → provides Playwright page fixtures
 *   - tests/demo_wizard/demo.fixtures.js → provides loginAs() helpers
 *
 * RULES:
 *   1. All persona constants, entity IDs, and seed resource IDs live HERE.
 *   2. Downstream modules IMPORT from this file — they do NOT redefine values.
 *   3. When a new persona is added, update THREE things:
 *      a) PERSONAS map below
 *      b) PERSONA_ENTITIES map below
 *      c) Nothing else — global.setup.js and base.fixtures.js consume these maps.
 *
 * Design rationale (Dependency Inversion Principle):
 *   Both the storageState approach (base.fixtures.js) and the loginAs() approach
 *   (demo.fixtures.js) depend on this shared abstraction rather than defining
 *   their own persona data. A single rename or addition propagates everywhere.
 */

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
export const DEMO_TOKEN = process.env.DEMO_TOKEN || 'demo-token';

// ---------------------------------------------------------------------------
// Persona Definitions
//
// Each persona has:
//   id            — stable UID used in auth_user localStorage
//   role          — x-demo-role header value (matches backend requireRole guard)
//   email         — mock email for auth_user
//   displayName   — human-readable name shown in UI
//   firestoreId   — optional Firestore document ID for the user record
//   linkedEntityId — entity this persona belongs to (retailer_id or advertiser_id)
//
// NOTE: role values MUST match the canonical lowercase enum values defined in
// DATABASE_SCHEMA.md § Canonical Enum Values. No uppercase outside test fixtures.
// ---------------------------------------------------------------------------

export const PERSONAS = {
  superadmin: {
    id: 'demo-superadmin-uid',
    role: 'superadmin',
    email: 'superadmin@softomedia.demo',
    displayName: 'Demo Super Admin',
    firestoreId: 'demo-superadmin',
    linkedEntityId: 'entity-superadmin-001',
  },

  admin: {
    id: 'demo-admin-uid',
    role: 'admin',
    email: 'admin@softomedia.demo',
    displayName: 'Demo Admin',
    firestoreId: 'demo-admin',
    linkedEntityId: 'entity-admin-001',
  },

  retailer: {
    id: 'demo-retailer-uid',
    role: 'retaileradmin',
    email: 'retailer@softomedia.demo',
    displayName: 'Demo Retailer',
    firestoreId: 'demo-retailer-freshmart',
    linkedEntityId: 'demo-retailer-freshmart',
  },

  brand: {
    id: 'demo-brand-uid',
    role: 'brand',
    email: 'brand@softomedia.demo',
    displayName: 'Demo Brand',
    firestoreId: 'demo-brand',
    linkedEntityId: 'demo-advertiser-bonvie',
  },

  advertiser: {
    id: 'demo-advertiser-uid',
    role: 'advertiser',
    email: 'advertiser@softomedia.demo',
    displayName: 'Demo Advertiser',
    firestoreId: 'demo-advertiser-bonvie',
    linkedEntityId: 'demo-advertiser-bonvie',
  },

  techoperator: {
    id: 'demo-techop-uid',
    role: 'techoperator',
    email: 'techop@softomedia.demo',
    displayName: 'Demo TechOps',
    firestoreId: 'demo-techop',
    linkedEntityId: 'entity-techop-001',
  },
};

// ---------------------------------------------------------------------------
// Convenience persona exports (named, for backward compatibility)
//
// Usage:  import { DEMO_ADMIN, DEMO_BRAND } from '../fixtures/personas.js';
// ---------------------------------------------------------------------------

export const DEMO_SUPERADMIN  = PERSONAS.superadmin;
export const DEMO_ADMIN       = PERSONAS.admin;
export const DEMO_RETAILER    = PERSONAS.retailer;
export const DEMO_BRAND       = PERSONAS.brand;
export const DEMO_ADVERTISER  = PERSONAS.advertiser;
export const DEMO_TECHOP      = PERSONAS.techoperator;

// ---------------------------------------------------------------------------
// Persona lookup map for global.setup.js iteration
//
// Keys = storageState filename stems (e.g., 'admin' → '.auth/admin.json')
// Values = { role, linkedEntityId } needed for localStorage injection
//
// IMPORTANT: The keys here determine the .auth/*.json filenames and must
// match the fixture names in base.fixtures.js (e.g., 'admin' → adminPage).
// ---------------------------------------------------------------------------

export const PERSONA_SETUP_LIST = Object.entries(PERSONAS).map(
  ([key, persona]) => ({
    key,                                      // storageState filename
    role: persona.role,                       // x-demo-role header value
    linkedEntityId: persona.linkedEntityId,    // linked_entity_id for campaigns.js stamping
    id: persona.id,
    email: persona.email,
    displayName: persona.displayName,
  }),
);

// ---------------------------------------------------------------------------
// Seeded Resource IDs — canonical values written by 00_seed.setup.js
//
// These MUST exactly match the IDs written during seeding.
// When 00_seed.setup.js changes an ID, update it HERE FIRST, then update
// any spec that references SEED.<field>.
// ---------------------------------------------------------------------------

export const SEED = {
  retailerId:   'demo-retailer-freshmart',
  advertiserId: 'demo-advertiser-bonvie',
  campaignId:   'demo-campaign-001',
  ticketId:     'demo-ticket-001',
  loopId:       'demo-loop-freshmart-main',

  screenIds: [
    'demo-screen-north-1',
    'demo-screen-north-2',
    'demo-screen-south-1',
    'demo-screen-south-2',
  ],

  storeIds: [
    'demo-store-mtl-north',
    'demo-store-mtl-south',
  ],
};
