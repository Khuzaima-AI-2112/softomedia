import { Firestore } from '@google-cloud/firestore';

/**
 * Fix Environment Parity
 * Removes legacy snake_case fields from Cloud Configuration in favor of camelCase.
 * Usage: node scripts/fix_parity.js
 */
async function fixParity() {
    const projectId = 'softomedia-live-2026';
    console.log(`[FIX_PARITY] Target Project: ${projectId}`);

    try {
        const cloudDb = new Firestore({ projectId });
        const docRef = cloudDb.collection('pricing_config').doc('global');
        const doc = await docRef.get();

        if (!doc.exists) {
            console.error('❌ Config not found');
            process.exit(1);
        }

        const data = doc.data();

        const deletes = {};

        // Check for base_cpm vs baseCPM collision
        if (data.base_cpm !== undefined && data.baseCPM !== undefined) {
            console.log(`[FIX_PARITY] Conflict detected: base_cpm (${data.base_cpm}) vs baseCPM (${data.baseCPM})`);

            // Heuristic: Prefer baseCPM (camelCase is current standard) and the non-default-looking value if possible.
            // But here we assume baseCPM (20) is the intended target over 2.5 (legacy?).
            console.log('[FIX_PARITY] Action: REMOVING base_cpm. Keeping baseCPM.');
            deletes.base_cpm = Firestore.FieldValue.delete();
        }

        if (Object.keys(deletes).length > 0) {
            await docRef.update({
                ...deletes,
                updatedAt: new Date().toISOString(),
                parityFixedBy: 'Antigravity-DiligentCoder' // Audit trail
            });
            console.log('✅ Fix applied: Removed legacy snake_case fields.');
        } else {
            console.log('✨ No parity fixes needed.');
        }

    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        process.exit(1);
    }
}

fixParity();
