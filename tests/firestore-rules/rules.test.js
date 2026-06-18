/**
 * Firestore Security Rules Unit Test Suite — Gap 4
 *
 * Closes the gap where the Playwright E2E suite (demo-token + x-demo-role)
 * bypasses JWT auth and never exercises Firestore Security Rules.
 *
 * Tool: @firebase/rules-unit-testing (official Firebase testing library)
 * Run: npm run test:rules
 * Requires: Firestore emulator on localhost:8090
 *
 * Test matrix: every collection × every role × read + write.
 * Source of truth: massivee2e_consolidated.md Gap 4.
 *
 * Add to package.json scripts:
 *   "test:rules": "firebase emulators:exec --only firestore 'jest tests/firestore-rules/'"
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'softomedia-demo',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8090,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const adminDb = () =>
  testEnv.authenticatedContext('demo-admin-uid', { role: 'admin' }).firestore();

const brandDb = () =>
  testEnv.authenticatedContext('demo-brand-uid', { role: 'brand', advertiserId: 'demo-bonvie' }).firestore();

const retailerDb = () =>
  testEnv.authenticatedContext('demo-retailer-uid', { role: 'retaileradmin', retailerId: 'demo-freshmart' }).firestore();

const advertiserDb = () =>
  testEnv.authenticatedContext('demo-advertiser-uid', { role: 'advertiser', advertiserId: 'demo-bonvie' }).firestore();

const publicDb = () =>
  testEnv.unauthenticatedContext().firestore();

// ─── retailers ───────────────────────────────────────────────────────────────

describe('retailers collection', () => {
  test('Admin can read retailers', async () =>
    assertSucceeds(adminDb().collection('retailers').get()));

  test('Admin can write retailers', async () =>
    assertSucceeds(adminDb().collection('retailers').doc('test-retailer').set({ name: 'Test' })));

  test('Brand cannot read retailers', async () =>
    assertFails(brandDb().collection('retailers').get()));

  test('Brand cannot write retailers', async () =>
    assertFails(brandDb().collection('retailers').doc('x').set({ name: 'X' })));

  test('Retailer can read own retailer doc', async () =>
    assertSucceeds(retailerDb().collection('retailers').doc('demo-freshmart').get()));

  test('Retailer cannot write retailer doc', async () =>
    assertFails(retailerDb().collection('retailers').doc('demo-freshmart').set({ name: 'Hack' })));

  test('Public cannot read retailers', async () =>
    assertFails(publicDb().collection('retailers').get()));
});

// ─── stores ──────────────────────────────────────────────────────────────────

describe('stores collection', () => {
  test('Admin can read stores', async () =>
    assertSucceeds(adminDb().collection('stores').get()));

  test('Admin can write stores', async () =>
    assertSucceeds(adminDb().collection('stores').doc('test-store').set({ retailerId: 'demo-freshmart' })));

  test('Brand cannot read stores', async () =>
    assertFails(brandDb().collection('stores').get()));

  test('Retailer can read own stores', async () =>
    assertSucceeds(retailerDb().collection('stores').where('retailerId', '==', 'demo-freshmart').get()));

  test('Retailer can write own stores', async () =>
    assertSucceeds(retailerDb().collection('stores').doc('own-store').set({ retailerId: 'demo-freshmart' })));

  test('Public cannot read stores', async () =>
    assertFails(publicDb().collection('stores').get()));
});

// ─── screens ─────────────────────────────────────────────────────────────────

describe('screens collection', () => {
  test('Admin can read screens', async () =>
    assertSucceeds(adminDb().collection('screens').get()));

  test('Admin can write screens', async () =>
    assertSucceeds(adminDb().collection('screens').doc('test-screen').set({ retailerId: 'demo-freshmart' })));

  test('Brand cannot read screens', async () =>
    assertFails(brandDb().collection('screens').get()));

  test('Retailer can read own screens', async () =>
    assertSucceeds(retailerDb().collection('screens').where('retailerId', '==', 'demo-freshmart').get()));

  test('Retailer cannot write screens', async () =>
    assertFails(retailerDb().collection('screens').doc('new-screen').set({ retailerId: 'demo-freshmart' })));

  test('Public cannot read screens', async () =>
    assertFails(publicDb().collection('screens').get()));
});

// ─── campaigns ───────────────────────────────────────────────────────────────

describe('campaigns collection', () => {
  test('Admin can read all campaigns', async () =>
    assertSucceeds(adminDb().collection('campaigns').get()));

  test('Admin can write campaigns', async () =>
    assertSucceeds(adminDb().collection('campaigns').doc('demo-campaign-001').set({ advertiserId: 'demo-bonvie', status: 'pending' })));

  test('Brand can read own campaigns', async () =>
    assertSucceeds(brandDb().collection('campaigns').where('advertiserId', '==', 'demo-bonvie').get()));

  test('Brand can write own campaigns', async () =>
    assertSucceeds(brandDb().collection('campaigns').doc('brand-new-campaign').set({ advertiserId: 'demo-bonvie' })));

  test('Brand cannot read other advertiser campaigns', async () =>
    assertFails(brandDb().collection('campaigns').where('advertiserId', '==', 'other-advertiser').get()));

  test('Retailer can read campaigns (for approval)', async () =>
    assertSucceeds(retailerDb().collection('campaigns').where('advertiserId', '==', 'demo-bonvie').get()));

  test('Retailer cannot write campaigns', async () =>
    assertFails(retailerDb().collection('campaigns').doc('x').set({ advertiserId: 'x' })));

  test('Public cannot read campaigns', async () =>
    assertFails(publicDb().collection('campaigns').get()));
});

// ─── loops ───────────────────────────────────────────────────────────────────

describe('loops collection', () => {
  test('Admin can read loops', async () =>
    assertSucceeds(adminDb().collection('loops').get()));

  test('Admin can write loops', async () =>
    assertSucceeds(adminDb().collection('loops').doc('demo-loop-001').set({ retailerId: 'demo-freshmart' })));

  test('Brand cannot read loops', async () =>
    assertFails(brandDb().collection('loops').get()));

  test('Retailer can read own loops', async () =>
    assertSucceeds(retailerDb().collection('loops').where('retailerId', '==', 'demo-freshmart').get()));

  test('Retailer cannot write loops', async () =>
    assertFails(retailerDb().collection('loops').doc('x').set({ retailerId: 'demo-freshmart' })));

  test('Public cannot read loops', async () =>
    assertFails(publicDb().collection('loops').get()));
});

// ─── users ───────────────────────────────────────────────────────────────────

describe('users collection', () => {
  test('Admin can read all users', async () =>
    assertSucceeds(adminDb().collection('users').get()));

  test('Admin can write users', async () =>
    assertSucceeds(adminDb().collection('users').doc('new-user').set({ role: 'brand' })));

  test('Brand can read own user doc', async () =>
    assertSucceeds(brandDb().collection('users').doc('demo-brand-uid').get()));

  test('Brand can write own user doc', async () =>
    assertSucceeds(brandDb().collection('users').doc('demo-brand-uid').set({ displayName: 'Updated' })));

  test('Retailer can read own user doc', async () =>
    assertSucceeds(retailerDb().collection('users').doc('demo-retailer-uid').get()));

  test('Retailer cannot write to other user docs', async () =>
    assertFails(retailerDb().collection('users').doc('demo-brand-uid').set({ role: 'admin' })));

  test('Public cannot read users', async () =>
    assertFails(publicDb().collection('users').get()));
});

// ─── telemetry ───────────────────────────────────────────────────────────────

describe('telemetry collection', () => {
  test('Admin can read telemetry', async () =>
    assertSucceeds(adminDb().collection('telemetry').get()));

  test('Admin can write telemetry', async () =>
    assertSucceeds(adminDb().collection('telemetry').doc('entry-1').set({ screenId: 'x', timestamp: Date.now() })));

  test('Brand cannot read telemetry', async () =>
    assertFails(brandDb().collection('telemetry').get()));

  test('Retailer cannot read telemetry', async () =>
    assertFails(retailerDb().collection('telemetry').get()));

  // Public device writes are allowed (player heartbeat)
  test('Public can write telemetry (device heartbeat)', async () =>
    assertSucceeds(publicDb().collection('telemetry').doc('heartbeat-1').set({
      screenId: 'demo-screen-01',
      timestamp: Date.now(),
      slotId: 'demo-slot-001',
    })));

  test('Public cannot read telemetry', async () =>
    assertFails(publicDb().collection('telemetry').get()));
});

// ─── impressions ─────────────────────────────────────────────────────────────

describe('impressions collection', () => {
  test('Admin can read impressions', async () =>
    assertSucceeds(adminDb().collection('impressions').get()));

  test('Admin can write impressions', async () =>
    assertSucceeds(adminDb().collection('impressions').doc('imp-1').set({ screenId: 'x', campaignId: 'y' })));

  test('Brand cannot read impressions', async () =>
    assertFails(brandDb().collection('impressions').get()));

  test('Retailer cannot read impressions', async () =>
    assertFails(retailerDb().collection('impressions').get()));

  // Public device writes are allowed (player impression recording)
  test('Public can write impressions (device impression)', async () =>
    assertSucceeds(publicDb().collection('impressions').doc('imp-device-1').set({
      screenId: 'demo-screen-01',
      campaignId: 'demo-campaign-001',
      timestamp: Date.now(),
    })));

  test('Public cannot read impressions', async () =>
    assertFails(publicDb().collection('impressions').get()));
});
