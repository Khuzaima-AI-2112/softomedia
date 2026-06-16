/**
 * S21-6: Seed "Test Retailer A" for staging/E2E use.
 *
 * Creates a single active retailer with a well-known ID (ret_test_a) so
 * E2E tests and the scheduler ?for=campaign endpoint have a guaranteed
 * fixture to assert against without depending on production data.
 *
 * Idempotent: if ret_test_a already exists with the correct shape the
 * script exits without writing. A stale record (wrong status or missing
 * fields) is overwritten.
 *
 * BEFORE RUNNING: set FIRESTORE_EMULATOR_HOST or ensure service-account
 * credentials are present in the environment.
 *
 * Run: node ad-server/scripts/seed-test-retailer-a.js
 */

import { getFirestore, closeFirestore } from '../src/utils/firestore.js';
import logger from '../src/utils/logger.js';

const RETAILER_ID = 'ret_test_a';
const COLLECTION  = 'retailers';

const FIXTURE = {
    id:            RETAILER_ID,
    name:          'Test Retailer A',
    logo:          '\uD83E\uDDEA',
    contact_email: 'test-retailer-a@softomedia.internal',
    status:        'active',
    deleted_at:    null,
    created_at:    new Date().toISOString(),
    updated_at:    new Date().toISOString(),
    _seeded_by:    'seed-test-retailer-a.js',
    _sprint:       'S21-6',
};

async function run() {
    const db  = getFirestore();
    const ref = db.collection(COLLECTION).doc(RETAILER_ID);

    logger.info(`[seed-test-retailer-a] Checking for existing ${RETAILER_ID}...`);
    const snap = await ref.get();

    if (snap.exists) {
        const data = snap.data();
        // Idempotent: skip if record already has the correct shape
        if (
            data.status     === 'active' &&
            data.deleted_at === null     &&
            data.name       === FIXTURE.name
        ) {
            logger.info(`[seed-test-retailer-a] ${RETAILER_ID} already correct — no write needed.`);
            await closeFirestore();
            return;
        }
        logger.warn(`[seed-test-retailer-a] ${RETAILER_ID} exists but is stale — overwriting.`);
    }

    await ref.set({
        ...FIXTURE,
        updated_at: new Date().toISOString(),
    });

    logger.info('[seed-test-retailer-a] \u2713 ret_test_a written to Firestore.');
    await closeFirestore();
}

run().catch(err => {
    logger.error('[seed-test-retailer-a] Fatal error:', err);
    process.exit(1);
});
