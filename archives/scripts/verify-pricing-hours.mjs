
import pricingService from '../client-app/src/services/PricingService.js';

// Mock the screens and config since we are running in isolation
pricingService.screens = [
    { id: 's1', store_id: 'store1', type: 'standard' },
    { id: 's2', store_id: 'store1', type: 'checkout' }
];

pricingService.config = {
    baseCPM: 10.00,
    trafficTiers: {
        medium: { multiplier: 1.0, label: 'Medium', hours: [10, 11, 12, 13] }
    },
    dateOverrides: {}
};

console.log('--- TEST 1: Default Range (8-22) ---');
const defaultSummary = pricingService.getDailyPricingSummary('2026-01-20');
console.log(`Hourly Slots: ${defaultSummary.hourlyBreakdown.length}`);
console.assert(defaultSummary.hourlyBreakdown.length === 14, 'Should have 14 slots (8 to 22)');
console.assert(defaultSummary.hourlyBreakdown[0].hour === 8, 'Start at 8');

console.log('\n--- TEST 2: Custom Range (10-14) ---');
const customSummary = pricingService.getDailyPricingSummary('2026-01-20', { START: 10, END: 14 });
console.log(`Hourly Slots: ${customSummary.hourlyBreakdown.length}`);
console.assert(customSummary.hourlyBreakdown.length === 4, 'Should have 4 slots (10 to 14)');
console.assert(customSummary.hourlyBreakdown[0].hour === 10, 'Start at 10');
console.assert(customSummary.hourlyBreakdown[3].hour === 13, 'End at 13 (exclusive 14)');

console.log('\n--- TEST 3: Closed Store (0-0) ---');
const closedSummary = pricingService.getDailyPricingSummary('2026-01-20', { START: 0, END: 0 });
console.log(`Hourly Slots: ${closedSummary.hourlyBreakdown.length}`);
console.assert(closedSummary.hourlyBreakdown.length === 0, 'Should have 0 slots');

console.log('\n✅ Verification Script Passed');
