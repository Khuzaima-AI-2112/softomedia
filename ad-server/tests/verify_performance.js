import { adRepository } from '../src/repositories/AdRepository.js';
import { loopGenerationService } from '../src/services/LoopGenerationService.js';

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

        const results = await adRepository.findAll({ limit: 5 });

        console.log(`Query returned ${results.length} items.`);
        if (results.length === 5) {
            console.log('✅ PASS: Limit parameter respected (fetched 5 items).');
        } else {
            console.error(`❌ FAIL: Expected 5 items, got ${results.length}. Limit ignored.`);
        }
    } catch (e) {
        console.error('❌ FAIL: Ad Repository test threw error:', e.message);
    }

    // Test 2: Parallel Loop Generation
    console.log('\n--- 2. Testing Parallel Loop Generation ---');
    try {
        const date = '2026-02-01'; // Future date
        const start = performance.now();

        const loops = await loopGenerationService.generateMockLoops(date, 'perf_retailer', 'perf_location');
        const end = performance.now();
        const duration = end - start;

        console.log(`Generated ${loops.length} loops in ${duration.toFixed(2)}ms.`);

        if (loops.length === 14) {
            console.log('✅ PASS: All 14 hourly loops generated.');
        } else {
            console.error(`❌ FAIL: Expected 14 loops, got ${loops.length}.`);
        }

    } catch (e) {
        console.error('❌ FAIL: Loop Generation test threw error:', e.message);
    }

    console.log('\n✅ Performance Verification Complete');
    process.exit(0);
}

verifyPerformance();
