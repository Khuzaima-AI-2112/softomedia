/**
 * S17-5: Backfill deleted_at for pre-sprint soft-deleted retailers.
 *
 * Targets retailers with status: 'inactive' and no deleted_at field.
 * Sets deleted_at = updated_at (or current ISO timestamp if updated_at is absent).
 *
 * BEFORE RUNNING: review current_sprint/sprint17.md § S17-5 Resolution.
 * Admin must confirm whether all inactive retailers are intended deletions
 * (Option A — run this script) or whether some are legitimately deactivated
 * (Option B — manual review required).
 *
 * Usage:
 *   node ad-server/scripts/backfill-deleted-retailers.js
 *
 * Run in STAGING first. Confirm zero ghost records return from GET /api/retailers.
 * Then run in production.
 *
 * Idempotent: re-running on an already-backfilled collection produces zero writes.
 */

import { getFirestore } from '../src/utils/firestore.js';

const BATCH_SIZE = 500;

async function backfill() {
    const db = getFirestore();
    if (!db) {
        console.error('Firestore unavailable — cannot run backfill in memory-only mode.');
        process.exit(1);
    }

    const snapshot = await db.collection('retailers')
        .where('status', '==', 'inactive')
        .get();

    const toBackfill = snapshot.docs.filter(doc => !doc.data().deleted_at);
    console.log(`Retailers to backfill: ${toBackfill.length} (of ${snapshot.size} inactive total)`);

    if (toBackfill.length === 0) {
        console.log('Nothing to do. Exiting.');
        return;
    }

    let totalWritten = 0;
    for (let i = 0; i < toBackfill.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = toBackfill.slice(i, i + BATCH_SIZE);
        chunk.forEach(doc => {
            const data = doc.data();
            const deletedAt = data.updated_at || new Date().toISOString();
            batch.set(doc.ref, { deleted_at: deletedAt }, { merge: true });
        });
        await batch.commit();
        totalWritten += chunk.length;
        console.log(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${totalWritten}/${toBackfill.length})`);
    }

    console.log(`Backfill complete. ${totalWritten} retailers updated.`);
}

backfill().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
