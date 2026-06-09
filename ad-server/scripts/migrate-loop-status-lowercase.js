/**
 * S16-1: migrate-loop-status-lowercase.js
 * ─────────────────────────────────────────
 * One-shot idempotent migration: ensures every document in the `loops`
 * Firestore collection carries a canonical LOOP_STATUS enum value.
 *
 * Background
 * ----------
 * Prior to S16-1, two routes in loops.js wrote raw uppercase strings directly
 * (e.g. 'REJECTED', 'APPROVED', 'PENDING'). The `loops` collection in
 * staging/production may therefore contain documents whose `status` field does
 * not exactly match the LOOP_STATUS constants exported from LoopRepository.js.
 * This script finds and corrects those documents.
 *
 * Canonical LOOP_STATUS values (from LoopRepository.js):
 *   PENDING_APPROVAL | APPROVED | REJECTED | LIVE
 *
 * Safety
 * ------
 *   DRY_RUN=true  (default) — scan and log only; zero writes
 *   DRY_RUN=false           — execute batched Firestore writes
 *
 * Usage
 * -----
 *   # Dry run (default)
 *   node ad-server/scripts/migrate-loop-status-lowercase.js
 *
 *   # Execute against staging (set your project first)
 *   DRY_RUN=false FIREBASE_PROJECT=softomedia-staging \
 *     node ad-server/scripts/migrate-loop-status-lowercase.js
 *
 *   # Execute against production (requires explicit opt-in)
 *   DRY_RUN=false FIREBASE_PROJECT=softomedia-prod ALLOW_PROD=true \
 *     node ad-server/scripts/migrate-loop-status-lowercase.js
 *
 * Idempotency
 * -----------
 * A document whose status is already a valid canonical value is skipped.
 * Re-running on a fully-migrated collection produces 0 writes and exits 0.
 *
 * Firestore batch limit: 500 operations per batch. This script chunks updates
 * into batches of MAX_BATCH_SIZE (default 400, conservative margin).
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN     = process.env.DRY_RUN !== 'false';   // default: true
const PROJECT_ID  = process.env.FIREBASE_PROJECT || null;
const ALLOW_PROD  = process.env.ALLOW_PROD === 'true';
const MAX_BATCH   = 400;

// Canonical enum — mirrors LoopRepository.js LOOP_STATUS exactly.
const LOOP_STATUS = {
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED:         'APPROVED',
    REJECTED:         'REJECTED',
    LIVE:             'LIVE',
};

const CANONICAL = new Set(Object.values(LOOP_STATUS));

/**
 * Map any legacy / typo value to its canonical replacement.
 * Extend this map if additional variants are discovered.
 *
 * Values already in CANONICAL pass through the identity check above
 * and never reach this map.
 */
const LEGACY_MAP = {
    // S13-2 bug: used SLOT_STATUS.PENDING instead of LOOP_STATUS.PENDING_APPROVAL
    'PENDING':          LOOP_STATUS.PENDING_APPROVAL,
    // Potential casing variants (defensive)
    'pending_approval': LOOP_STATUS.PENDING_APPROVAL,
    'approved':         LOOP_STATUS.APPROVED,
    'rejected':         LOOP_STATUS.REJECTED,
    'live':             LOOP_STATUS.LIVE,
    'pending':          LOOP_STATUS.PENDING_APPROVAL,
};

// ─── Guards ───────────────────────────────────────────────────────────────────

if (PROJECT_ID && PROJECT_ID.includes('prod') && !ALLOW_PROD) {
    console.error(
        '[migrate] ERROR: Production project detected but ALLOW_PROD is not set.\n' +
        '  Set ALLOW_PROD=true explicitly to run against production.'
    );
    process.exit(1);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (!getApps().length) {
    const appConfig = PROJECT_ID ? { projectId: PROJECT_ID } : {};
    // In CI/production use GOOGLE_APPLICATION_CREDENTIALS or ADC.
    // Locally, set GOOGLE_APPLICATION_CREDENTIALS to a service account key file.
    initializeApp(appConfig);
}

const db = getFirestore();

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    console.log(`[migrate] Starting loop status migration`);
    console.log(`[migrate] DRY_RUN=${DRY_RUN}  PROJECT=${PROJECT_ID || '(default / emulator)'}`);
    console.log(`[migrate] Canonical values: ${[...CANONICAL].join(', ')}`);
    console.log();

    const snapshot = await db.collection('loops').get();
    console.log(`[migrate] Total documents scanned: ${snapshot.size}`);

    const toFix = [];

    for (const doc of snapshot.docs) {
        const data   = doc.data();
        const status = data.status;

        if (CANONICAL.has(status)) {
            // Already canonical — skip.
            continue;
        }

        const canonical = LEGACY_MAP[status];

        if (!canonical) {
            console.warn(`[migrate] WARN  doc=${doc.id}  status="${status}" — unknown value, no mapping defined. Skipping.`);
            continue;
        }

        toFix.push({ ref: doc.ref, id: doc.id, from: status, to: canonical });
    }

    console.log(`[migrate] Documents requiring update: ${toFix.length}`);

    if (toFix.length === 0) {
        console.log('[migrate] Collection is already fully migrated. Nothing to do.');
        process.exit(0);
    }

    // Log every affected document regardless of DRY_RUN.
    for (const item of toFix) {
        console.log(`[migrate] ${DRY_RUN ? 'DRY' : 'FIX'}  doc=${item.id}  "${item.from}" → "${item.to}"`);
    }

    if (DRY_RUN) {
        console.log();
        console.log(`[migrate] Dry run complete. ${toFix.length} document(s) would be updated.`);
        console.log('[migrate] Re-run with DRY_RUN=false to apply.');
        process.exit(0);
    }

    // ── Write in batches ──────────────────────────────────────────────────────
    let batchCount  = 0;
    let writeCount  = 0;

    for (let i = 0; i < toFix.length; i += MAX_BATCH) {
        const chunk = toFix.slice(i, i + MAX_BATCH);
        const batch = db.batch();

        for (const item of chunk) {
            batch.update(item.ref, {
                status:          item.to,
                _migrated_at:    new Date().toISOString(),
                _migrated_from:  item.from,
            });
        }

        await batch.commit();
        batchCount++;
        writeCount += chunk.length;
        console.log(`[migrate] Batch ${batchCount} committed (${chunk.length} docs).`);
    }

    console.log();
    console.log(`[migrate] Migration complete. ${writeCount} document(s) updated in ${batchCount} batch(es).`);
    process.exit(0);
}

run().catch(err => {
    console.error('[migrate] FATAL', err);
    process.exit(1);
});
