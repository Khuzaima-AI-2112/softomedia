
import SpecialHoursRepository from '../src/repositories/SpecialHoursRepository.js';
import BusinessHoursService from '../src/services/BusinessHoursService.js';

async function runTest() {
    const storeId = 'test-store-reproduction-400';
    const date = '2026-02-05';
    // Mimin the frontend payload more closely
    const hoursData = {
        is_closed: true,
        reason: 'Renovation Test 2',
        open_time: '09:00', // Frontend sends times even if closed
        close_time: '18:00'
    };

    console.log(`[TEST] Updating Special Hours... Data:`, hoursData);

    try {
        const result = await BusinessHoursService.updateSpecialHours(storeId, date, hoursData);
        console.log('[TEST] Result SUCCESS:', result);
    } catch (e) {
        const fs = await import('fs');
        fs.writeFileSync('error_log.txt', `[TEST] FAILED: ${e.message}\nStack: ${e.stack}`);
        process.exit(1);
    }

    console.log(`[TEST] Fetching...`);
    // ... rest of checking logic
    const effective = await BusinessHoursService.getEffectiveHours(storeId, date);
    if (effective.is_closed === true) {
        console.log('[TEST] SUCCESS: Correctly closed.');
    } else {
        const fs = await import('fs');
        fs.writeFileSync('error_log.txt', `[TEST] FAIL: returned not closed: ${JSON.stringify(effective)}`);
        process.exit(1);
    }
}

runTest().then(() => process.exit(0)).catch(async e => {
    const fs = await import('fs');
    fs.writeFileSync('error_log.txt', `Fatal Error: ${e.message}\n${e.stack}`);
    process.exit(1);
});
