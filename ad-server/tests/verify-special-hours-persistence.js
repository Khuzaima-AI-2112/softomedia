
import SpecialHoursRepository from '../src/repositories/SpecialHoursRepository.js';
import BusinessHoursService from '../src/services/BusinessHoursService.js';

async function runTest() {
    const storeId = 'test-store-reproduction';
    const date = '2026-02-01'; // Future date
    const hoursData = {
        is_closed: true,
        reason: 'Renovation Test',
        open_time: null,
        close_time: null
    };

    console.log(`[TEST] 1. Updating Special Hours for Store ${storeId} on ${date}...`);
    try {
        // This relies on the BaseRepository.update implementation which MIGHT mistakenly succeed in memory 
        // but fail in real Firestore if document doesn't exist, OR fail if we test properly.
        // However, analyzing the code, we saw it calls this.update(id, ...). 
        // If the ID is new, BaseRepository.update attempts to doc(id).update(), which FAILS in Firestore if doc missing.
        await BusinessHoursService.updateSpecialHours(storeId, date, hoursData);
        console.log('[TEST] Update call completed (Note: might have fallen back to memory silently)');
    } catch (e) {
        console.error('[TEST] Update FAILED as expected (or unexpected):', e.message);
    }

    console.log(`[TEST] 2. Fetching Effective Hours...`);
    const effective = await BusinessHoursService.getEffectiveHours(storeId, date);
    
    console.log('[TEST] Result:', effective);

    if (effective && effective.type === 'special' && effective.is_closed === true) {
        console.log('[TEST] SUCCESS: Special hours returned correctly.');
    } else {
        console.log('[TEST] FAILURE: Special hours NOT returned correctly.');
        console.log('Expected type="special" and is_closed=true');
        process.exit(1);
    }
}

runTest().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
