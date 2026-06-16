/**
 * S17-5 / S21-1: Backfill deleted_at for pre-sprint soft-deleted retailers.
 *
 * Targets retailers with status: 'inactive' and no deleted_at field.
 * Sets deleted_at = updated_at (or current ISO timestamp if updated_at is absent).
 *
 * STRATEGY DECISION: OPTION A (Aggressive)
 * All retailers with status='inactive' and no deleted_at are treated as
 * soft-deleted records (ghost records) and will receive a deleted_at backfill.
 * Rationale: the admin UI has a separate PATCH /api/retailers/:id updateStatus
 * path (added in S17) that sets status='inactive' without writing deleted_at.
 * However, prior to the S17 deploy, no such separate deactivate path existed —
 * any "deactivation" in earlier sprints was implemented as a DELETE (softDelete
 * call). Therefore, all pre-S17 inactive retailers are presumed deleted, not
 * intentionally deactivated.
 * If your data includes legitimate pre-S17 deactivations (retailers that were
 * intentionally set inactive but never deleted), switch to Option B: filter
 * candidates by has_stores / has_screens before writing deleted_at, and
 * manually review the remainder.
 *
 * BEFORE RUNNING: review current_sprint/sprint21.md § S21-1.
 * Run in STAGING first. Confirm zero ghost records return from GET /api/retailers.
 * Then run in production.
 *
 * Idempotent: re-running on an already-backfilled collection produces zero writes.
 * Exits non-zero on any Firestore write failure.
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
