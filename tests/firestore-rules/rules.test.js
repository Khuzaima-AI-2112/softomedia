/**
 * Firestore Security Rules Unit Test Suite
 *
 * Gap 4 closure: proves Firestore access control rules are correctly
 * configured for all 8 collections across all 5 roles.
 *
 * Tool: @firebase/rules-unit-testing (official Firebase testing library)
 * Run:  npm run test:rules
 *
 * Add to package.json scripts:
 *   "test:rules": "firebase emulators:exec --only firestore 'jest tests/firestore-rules/'"
 *
 * Requires:
 *   - Firebase emulator running on localhost:8090 (default Firestore emulator port)
 *   - firestore.rules file at repo root
 *   - jest configured for ESM (or transpile with babel-jest)
 *
 * Test matrix — one assertion per collection per role:
 *
 *   Collection   | Admin read/write | Brand read/write | Retailer read/write | Public read | Device write
 *   -------------|------------------|------------------|---------------------|-------------|-------------
 *   retailers    | allow / allow    | deny / deny      | own only / deny     | deny        | —
 *   stores       | allow / allow    | deny / deny      | own only / own only | deny        | —
 *   screens      | allow / allow    | deny / deny      | own only / deny     | deny        | —
 *   campaigns    | allow / allow    | own only / own   | own only / deny     | deny        | —
 *   loops        | allow / allow    | deny / deny      | own only / deny     | deny        | —
 *   users        | allow / allow    | own only / own   | own only / deny     | deny        | —
 *   telemetry    | allow / allow    | deny / deny      | deny / deny         | deny        | allow
 *   impressions  | allow / allow    | deny / deny      | deny / deny         | deny        | allow
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

const PROJECT_ID = 'softomedia-demo';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host:  'localhost',
      port:  8090,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function adminDb() {
  return testEnv
    .authenticatedContext('admin-uid', { role: 'admin' })
    .firestore();
}

function brandDb(advertiserId = 'demo-advertiser-bonvie') {
  return testEnv
    .authenticatedContext('brand-uid', { role: 'brand', advertiserId })
    .firestore();
}

function retailerDb(retailerId = 'demo-retailer-freshmart') {
  return testEnv
    .authenticatedContext('retailer-uid', { role: 'retaileradmin', retailerId })
    .firestore();
}

function publicDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function deviceDb(deviceId = 'demo-device-001') {
  return testEnv
    .authenticatedContext('device-uid', { role: 'device', deviceId })
    .firestore();
}

// Seed a doc as admin (bypasses rules for test setup)
async function seedDoc(collection, id, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(collection).doc(id).set(data);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// retailers
// ─────────────────────────────────────────────────────────────────────────────

describe('retailers', () => {
  const COL = 'retailers';
  const DOC = 'demo-retailer-freshmart';
  const DATA = { name: 'FreshMart Montréal', status: 'active' };

  beforeEach(() => seedDoc(COL, DOC, DATA));

  test('admin can read', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).get());
  });

  test('admin can write', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).update({ name: 'Updated' }));
  });

  test('brand cannot read', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).get());
  });

  test('brand cannot write', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).update({ name: 'Hacked' }));
  });

  test('retailer can read own retailer doc', async () => {
    // retailerDb('demo-retailer-freshmart') → reading its own doc
    await assertSucceeds(retailerDb(DOC).collection(COL).doc(DOC).get());
  });

  test('retailer cannot write retailer doc', async () => {
    await assertFails(retailerDb(DOC).collection(COL).doc(DOC).update({ name: 'Self-edit' }));
  });

  test('public cannot read', async () => {
    await assertFails(publicDb().collection(COL).doc(DOC).get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stores
// ─────────────────────────────────────────────────────────────────────────────

describe('stores', () => {
  const COL = 'stores';
  const DOC = 'demo-store-mtl-north';
  const DATA = { name: 'FreshMart Downtown', retailerId: 'demo-retailer-freshmart', status: 'active' };

  beforeEach(() => seedDoc(COL, DOC, DATA));

  test('admin can read', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).get());
  });

  test('admin can write', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).update({ status: 'inactive' }));
  });

  test('brand cannot read', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).get());
  });

  test('brand cannot write', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).update({ name: 'Hacked' }));
  });

  test('retailer can read own store', async () => {
    await assertSucceeds(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).get(),
    );
  });

  test('retailer can write own store', async () => {
    await assertSucceeds(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).update({ status: 'active' }),
    );
  });

  test('retailer cannot write another retailer store', async () => {
    await assertFails(
      retailerDb('other-retailer').collection(COL).doc(DOC).update({ name: 'Hijacked' }),
    );
  });

  test('public cannot read', async () => {
    await assertFails(publicDb().collection(COL).doc(DOC).get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// screens
// ─────────────────────────────────────────────────────────────────────────────

describe('screens', () => {
  const COL = 'screens';
  const DOC = 'demo-screen-north-1';
  const DATA = { name: 'Downtown Entrance', retailerId: 'demo-retailer-freshmart', status: 'active' };

  beforeEach(() => seedDoc(COL, DOC, DATA));

  test('admin can read', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).get());
  });

  test('admin can write', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).update({ status: 'inactive' }));
  });

  test('brand cannot read', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).get());
  });

  test('brand cannot write', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).update({ name: 'Hacked' }));
  });

  test('retailer can read own screen', async () => {
    await assertSucceeds(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).get(),
    );
  });

  test('retailer cannot write screen', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).update({ name: 'Self-edit' }),
    );
  });

  test('public cannot read', async () => {
    await assertFails(publicDb().collection(COL).doc(DOC).get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// campaigns
// ─────────────────────────────────────────────────────────────────────────────

describe('campaigns', () => {
  const COL = 'campaigns';
  const DOC = 'demo-campaign-001';
  const DATA = { name: 'BonVie Summer', advertiserId: 'demo-advertiser-bonvie', status: 'pending' };
  const OTHER_DOC = 'other-campaign-999';
  const OTHER_DATA = { name: 'Rival Campaign', advertiserId: 'other-advertiser', status: 'active' };

  beforeEach(async () => {
    await seedDoc(COL, DOC, DATA);
    await seedDoc(COL, OTHER_DOC, OTHER_DATA);
  });

  test('admin can read any campaign', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).get());
    await assertSucceeds(adminDb().collection(COL).doc(OTHER_DOC).get());
  });

  test('admin can write any campaign', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).update({ status: 'approved' }));
  });

  test('brand can read own advertiser campaigns', async () => {
    await assertSucceeds(
      brandDb('demo-advertiser-bonvie').collection(COL).doc(DOC).get(),
    );
  });

  test('brand cannot read other advertiser campaigns', async () => {
    await assertFails(
      brandDb('demo-advertiser-bonvie').collection(COL).doc(OTHER_DOC).get(),
    );
  });

  test('brand can create campaign for own advertiser', async () => {
    await assertSucceeds(
      brandDb('demo-advertiser-bonvie').collection(COL).add({
        name: 'New BonVie Campaign',
        advertiserId: 'demo-advertiser-bonvie',
        status: 'draft',
      }),
    );
  });

  test('retailer can read campaign for their retailer', async () => {
    // Retailer seeing campaigns targeting their stores
    await assertSucceeds(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).get(),
    );
  });

  test('retailer cannot write campaign', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).update({ status: 'approved' }),
    );
  });

  test('public cannot read', async () => {
    await assertFails(publicDb().collection(COL).doc(DOC).get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// loops
// ─────────────────────────────────────────────────────────────────────────────

describe('loops', () => {
  const COL = 'loops';
  const DOC = 'demo-loop-freshmart-main';
  const DATA = { name: 'FreshMart Standard Loop', retailerId: 'demo-retailer-freshmart', status: 'approved' };

  beforeEach(() => seedDoc(COL, DOC, DATA));

  test('admin can read', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).get());
  });

  test('admin can write', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).update({ status: 'locked' }));
  });

  test('brand cannot read', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).get());
  });

  test('brand cannot write', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).update({ name: 'Hacked' }));
  });

  test('retailer can read own loop', async () => {
    await assertSucceeds(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).get(),
    );
  });

  test('retailer cannot write loop', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).update({ status: 'approved' }),
    );
  });

  test('public cannot read', async () => {
    await assertFails(publicDb().collection(COL).doc(DOC).get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// users
// ─────────────────────────────────────────────────────────────────────────────

describe('users', () => {
  const COL = 'users';
  const BRAND_DOC = 'brand-uid';
  const BRAND_DATA = { email: 'brand@softomedia.demo', role: 'brand', linkedEntityId: 'demo-advertiser-bonvie' };
  const OTHER_DOC = 'other-user-uid';
  const OTHER_DATA = { email: 'other@softomedia.demo', role: 'brand', linkedEntityId: 'other-advertiser' };

  beforeEach(async () => {
    await seedDoc(COL, BRAND_DOC, BRAND_DATA);
    await seedDoc(COL, OTHER_DOC, OTHER_DATA);
  });

  test('admin can read any user', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(BRAND_DOC).get());
    await assertSucceeds(adminDb().collection(COL).doc(OTHER_DOC).get());
  });

  test('admin can write any user', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(BRAND_DOC).update({ status: 'inactive' }));
  });

  test('brand can read own user doc', async () => {
    await assertSucceeds(
      brandDb('demo-advertiser-bonvie').collection(COL).doc(BRAND_DOC).get(),
    );
  });

  test('brand cannot read other user doc', async () => {
    await assertFails(
      brandDb('demo-advertiser-bonvie').collection(COL).doc(OTHER_DOC).get(),
    );
  });

  test('brand can update own user doc', async () => {
    await assertSucceeds(
      brandDb('demo-advertiser-bonvie').collection(COL).doc(BRAND_DOC).update({ displayName: 'Updated' }),
    );
  });

  test('retailer can read own user doc', async () => {
    const RETAILER_DOC = 'retailer-uid';
    await seedDoc(COL, RETAILER_DOC, { email: 'retailer@softomedia.demo', role: 'retaileradmin' });
    await assertSucceeds(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(RETAILER_DOC).get(),
    );
  });

  test('retailer cannot write user doc', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(BRAND_DOC).update({ role: 'admin' }),
    );
  });

  test('public cannot read', async () => {
    await assertFails(publicDb().collection(COL).doc(BRAND_DOC).get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// telemetry
// ─────────────────────────────────────────────────────────────────────────────

describe('telemetry', () => {
  const COL = 'telemetry';
  const DOC = 'telemetry-event-001';
  const DATA = { screenId: 'demo-screen-north-1', campaignId: 'demo-campaign-001', playedAt: Date.now() };

  beforeEach(() => seedDoc(COL, DOC, DATA));

  test('admin can read', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).get());
  });

  test('admin can write', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).update({ verified: true }));
  });

  test('brand cannot read', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).get());
  });

  test('brand cannot write', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).set({ ...DATA, tampered: true }));
  });

  test('retailer cannot read', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).get(),
    );
  });

  test('retailer cannot write', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).set({ ...DATA }),
    );
  });

  test('public cannot read', async () => {
    await assertFails(publicDb().collection(COL).doc(DOC).get());
  });

  test('device can write telemetry (player heartbeat)', async () => {
    await assertSucceeds(
      deviceDb('demo-screen-north-1').collection(COL).add({
        screenId:   'demo-screen-north-1',
        campaignId: 'demo-campaign-001',
        playedAt:   Date.now(),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// impressions
// ─────────────────────────────────────────────────────────────────────────────

describe('impressions', () => {
  const COL = 'impressions';
  const DOC = 'impression-001';
  const DATA = {
    screenId:   'demo-screen-north-1',
    campaignId: 'demo-campaign-001',
    assetId:    'demo-asset-001',
    loopId:     'demo-loop-freshmart-main',
    playedAt:   Date.now(),
  };

  beforeEach(() => seedDoc(COL, DOC, DATA));

  test('admin can read', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).get());
  });

  test('admin can write', async () => {
    await assertSucceeds(adminDb().collection(COL).doc(DOC).update({ verified: true }));
  });

  test('brand cannot read impressions', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).get());
  });

  test('brand cannot write impressions', async () => {
    await assertFails(brandDb().collection(COL).doc(DOC).set({ ...DATA, tampered: true }));
  });

  test('retailer cannot read impressions', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).get(),
    );
  });

  test('retailer cannot write impressions', async () => {
    await assertFails(
      retailerDb('demo-retailer-freshmart').collection(COL).doc(DOC).set({ ...DATA }),
    );
  });

  test('public cannot read impressions', async () => {
    await assertFails(publicDb().collection(COL).doc(DOC).get());
  });

  test('device can write impression record (ad play event)', async () => {
    await assertSucceeds(
      deviceDb('demo-screen-north-1').collection(COL).add({
        screenId:   'demo-screen-north-1',
        campaignId: 'demo-campaign-001',
        playedAt:   Date.now(),
      }),
    );
  });
});
