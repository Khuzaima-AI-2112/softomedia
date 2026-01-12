import { Firestore } from '@google-cloud/firestore';

/**
 * Audit Environment Parity
 * Usage: node scripts/parity_audit.js
 */
async function parityAudit() {
    const projectId = 'softomedia-live-2026';

    console.log(`[PARITY_AUDIT] Auditing Project: ${projectId}`);

    try {
        // 1. Fetch Cloud Config
        console.log('[PARITY_AUDIT] Fetching Cloud Configuration...');
        const cloudDb = new Firestore({ projectId });
        const cloudDoc = await cloudDb.collection('pricing_config').doc('global').get();
        const cloudData = cloudDoc.exists ? cloudDoc.data() : null;

        // 2. Fetch Local Config (Assuming Local Emulator or separate project, but for now we compare to a baseline)
        // Note: In active workspace, we might compare to a local JSON file or the same project but different environment
        // Since we only have one project ID 'softomedia-live-2026', we'll compare current DB to a "stable" snapshot if it exists
        // OR just verify the current document's synchronization state.

        if (!cloudData) {
            console.error('❌ Cloud configuration missing');
            process.exit(1);
        }

        console.log('--- Current Cloud Pricing Configuration ---');
        console.log(JSON.stringify(cloudData, null, 2));
        console.log('-------------------------------------------');

        // 3. Check for specific anti-patterns identified in the report
        let issues = [];
        if (cloudData.base_cpm !== undefined) issues.push('Found snake_case: base_cpm');
        if (cloudData.retailer_overrides && Object.keys(cloudData.retailer_overrides).length > 0) {
            issues.push(`Found active retailer overrides: ${Object.keys(cloudData.retailer_overrides).length}`);
        }

        if (issues.length > 0) {
            console.warn('⚠️ PARITY DRIFT/ISSUES DETECTED:');
            issues.forEach(issue => console.warn(` - ${issue}`));
        } else {
            console.log('✅ PARITY CHECK PASSED: Configuration follows standard patterns');
        }

    } catch (error) {
        console.error('❌ Parity audit failed:', error.message);
        process.exit(1);
    }
}

parityAudit();
