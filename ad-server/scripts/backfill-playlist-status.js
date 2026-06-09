/**
 * S17-6 / RISK-S16-9: Backfill playlist status from uppercase 'ACTIVE' to lowercase 'active'.
 *
 * PlaylistRepository.findActiveByScreen() and findGlobalPlaylist() now query
 * status == 'active' (lowercase). Documents written before the S13 enum fix
 * may carry uppercase 'ACTIVE'. This script normalises them.
 *
 * MUST run in staging before S17-6 PlaylistRepository change is promoted to
 * production — otherwise playlists with uppercase 'ACTIVE' will be invisible
 * to findActiveByScreen() and screens will show no active playlists.
 *
 * Usage:
 *   node ad-server/scripts/backfill-playlist-status.js
 *
 * Idempotent: documents already carrying lowercase 'active' are not written.
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

    const snapshot = await db.collection('playlists')
        .where('status', '==', 'ACTIVE')
        .get();

    console.log(`Playlists with uppercase 'ACTIVE' to normalise: ${snapshot.size}`);

    if (snapshot.size === 0) {
        console.log('Nothing to do. Exiting.');
        return;
    }

    let totalWritten = 0;
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(doc => {
            batch.set(doc.ref, {
                status: 'active',
                updated_at: new Date().toISOString()
            }, { merge: true });
        });
        await batch.commit();
        totalWritten += chunk.length;
        console.log(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${totalWritten}/${snapshot.docs.length})`);
    }

    console.log(`Backfill complete. ${totalWritten} playlist documents normalised.`);
}

backfill().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
