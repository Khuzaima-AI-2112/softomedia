/**
 * Firebase Security Rules — deny-by-default contract.
 *
 * Every Softomedia business read and write traverses the authenticated Express
 * API, which uses privileged credentials. No browser, device, or signed-in
 * Firebase user may read or write Firestore documents or Storage objects
 * directly, whatever custom claims its token carries.
 *
 * Run: npm run test:rules (starts the Firestore and Storage emulators)
 */

const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');
const { ref, uploadString, getBytes } = require('firebase/storage');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const COLLECTIONS = [
  'users',
  'retailers',
  'advertisers',
  'stores',
  'locations',
  'screens',
  'campaigns',
  'media',
  'loops',
  'daily_schedules',
  'impressions',
  'playback_observations',
  'telemetry',
  'support_tickets',
  'pricing_config',
  'platform_audits',
  'invoices',
];

const IDENTITIES = [
  ['an unauthenticated client', null],
  ['a Brand user with role claims', { uid: 'brand-uid', claims: { role: 'brand', advertiserId: 'demo-advertiser-bonvie' } }],
  ['a Retailer user with role claims', { uid: 'retailer-uid', claims: { role: 'retaileradmin', retailerId: 'demo-retailer-freshmart' } }],
  ['an Admin-claimed user', { uid: 'admin-uid', claims: { role: 'admin' } }],
  ['a Super Administrator-claimed user', { uid: 'superadmin-uid', claims: { role: 'superadmin' } }],
];

jest.setTimeout(60_000);

let testEnv;

const contextFor = identity => (identity
  ? testEnv.authenticatedContext(identity.uid, identity.claims)
  : testEnv.unauthenticatedContext());

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'softomedia-demo',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../ad-server/firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8090,
    },
    storage: {
      rules: readFileSync(resolve(__dirname, '../../ad-server/storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });

  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all(COLLECTIONS.map(collection => setDoc(doc(db, collection, 'existing'), {
      retailer_id: 'demo-retailer-freshmart',
      advertiser_id: 'demo-advertiser-bonvie',
    })));
    await setDoc(doc(db, 'users', 'brand-uid'), { role: 'brand' });
    await uploadString(ref(context.storage(), 'media/existing.png'), 'synthetic');
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe.each(IDENTITIES)('%s', (_label, identity) => {
  test.each(COLLECTIONS)('cannot read or write %s documents directly', async collection => {
    const db = contextFor(identity).firestore();

    await assertFails(getDoc(doc(db, collection, 'existing')));
    await assertFails(setDoc(doc(db, collection, 'existing'), { retailer_id: 'forged' }));
    await assertFails(setDoc(doc(db, collection, 'created-by-client'), { retailer_id: 'forged' }));
  });

  test('cannot read or upload Storage objects directly', async () => {
    const storage = contextFor(identity).storage();

    await assertFails(getBytes(ref(storage, 'media/existing.png')));
    await assertFails(uploadString(ref(storage, 'media/forged.png'), 'forged'));
  });
});

test('a signed-in user cannot change the role on its own profile', async () => {
  const db = testEnv.authenticatedContext('brand-uid', { role: 'brand' }).firestore();

  await assertFails(updateDoc(doc(db, 'users', 'brand-uid'), { role: 'superadmin' }));
  await assertFails(setDoc(doc(db, 'users', 'brand-uid'), { role: 'superadmin' }));
});

test('no client can forge Proof of Play or telemetry records', async () => {
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(db, 'impressions', 'forged-event'), { campaign_id: 'demo-campaign', screen_id: 'any' }));
  await assertFails(setDoc(doc(db, 'telemetry', 'forged-heartbeat'), { screen_id: 'any', status: 'ONLINE' }));
});
