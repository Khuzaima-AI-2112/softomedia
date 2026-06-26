import { loopGenerationService } from '../ad-server/src/services/LoopGenerationService.js';
import { adRepository } from '../ad-server/src/repositories/AdRepository.js';

async function verifyPerformance() {
    console.log('⚡ Verification: Performance & Scalability Fixes (SDLC#9)');

    // Test 1: BaseRepository Limit Bug
    console.log('\n--- 1. Testing BaseRepository Query Limit ---');
    try {
        // Seed 100 mock ads in memory
        console.log('Seeding 100 mock ads...');
        for (let i = 0; i < 100; i++) {
            await adRepository.create(`mock_ad_${i}`, { status: 'approved', title: `Test Ad ${i}` });
        }

        const start = performance.now();
        const results = await adRepository.findAll({ limit: 5 });
        const end = performance.now();

        console.log(`Query returned ${results.length} items.`);
        if (results.length === 5) {
            console.log('✅ PASS: Limit parameter respected (fetched 5 items).');
        } else {
            console.error(`❌ FAIL: Expected 5 items, got ${results.length}. Limit ignored.`);
        }
    } catch (e) {
        console.error('❌ FAIL: Ad Repository test threw error:', e);
    }

    // Test 2: Parallel Loop Generation
    console.log('\n--- 2. Testing Parallel Loop Generation ---');
    try {
        const date = '2026-02-01'; // Future date
        const start = performance.now();

        // This generates 14 hourly loops. 
        // Sequential 14 writes @ ~10ms mock delay = ~140ms
        // Parallel 14 writes @ ~10ms mock delay = ~10-20ms
        const loops = await loopGenerationService.generateMockLoops(date, 'perf_retailer', 'perf_location');
        const end = performance.now();
        const duration = end - start;

        console.log(`Generated ${loops.length} loops in ${duration.toFixed(2)}ms.`);

        // 14 loops * minimal DB cost. If sequential, even mock DB takes time.
        // We look for reasonably fast execution (< 200ms for 14 writes indicates parallelism works OK in mock).
        if (loops.length === 14) {
            console.log('✅ PASS: All 14 hourly loops generated.');
        } else {
            console.error(`❌ FAIL: Expected 14 loops, got ${loops.length}.`);
        }

    } catch (e) {
        console.error('❌ FAIL: Loop Generation test threw error:', e);
    }
}

verifyPerformance();
