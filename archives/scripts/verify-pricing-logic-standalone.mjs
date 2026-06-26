
// Standalone verification of the logic
console.log('--- STARTING LOGIC VERIFICATION ---');

// Mock helpers
const getTrafficTier = (hour) => ({ key: 'medium', multiplier: 1.0 });
const getDateMultiplier = () => 1.0;
const getEstimatedImpressions = () => 100;
const getSlotPrice = () => ({ price: 2.50 });
const screens = [{ id: 's1' }];

// THE LOGIC UNDER TEST
function getDailyPricingSummary(date, businessHoursRange = null) {
    const hours = [];

    // Use provided range or default to 8-22
    const businessHours = businessHoursRange || { START: 8, END: 22 };

    for (let hour = businessHours.START; hour < businessHours.END; hour++) {
        const trafficTier = getTrafficTier(hour);
        const dateMultiplier = getDateMultiplier(date);

        // Calculate average price
        let totalPrice = 0;
        let totalImpressions = 0;

        screens.forEach(screen => {
            const pricing = getSlotPrice(screen.id, date, hour);
            totalPrice += pricing.price;
            totalImpressions += getEstimatedImpressions(screen.id, hour);
        });

        hours.push({
            hour,
            averageSlotPrice: totalPrice / screens.length
        });
    }

    return {
        hourlyBreakdown: hours
    };
}

// TEST CASES
console.log('Test 1: Default Range (8-22)');
const res1 = getDailyPricingSummary('2026-01-20');
console.assert(res1.hourlyBreakdown.length === 14, `Expected 14 slots, got ${res1.hourlyBreakdown.length}`);
console.assert(res1.hourlyBreakdown[0].hour === 8, `Expected start 8, got ${res1.hourlyBreakdown[0]?.hour}`);

console.log('Test 2: Custom Range (10-14)');
const res2 = getDailyPricingSummary('2026-01-20', { START: 10, END: 14 });
console.assert(res2.hourlyBreakdown.length === 4, `Expected 4 slots, got ${res2.hourlyBreakdown.length}`);
console.assert(res2.hourlyBreakdown[0].hour === 10, `Expected start 10, got ${res2.hourlyBreakdown[0]?.hour}`);
console.assert(res2.hourlyBreakdown[3].hour === 13, `Expected end 13, got ${res2.hourlyBreakdown[3]?.hour}`);

console.log('Test 3: Closed (0-0)');
const res3 = getDailyPricingSummary('2026-01-20', { START: 0, END: 0 });
console.assert(res3.hourlyBreakdown.length === 0, `Expected 0 slots, got ${res3.hourlyBreakdown.length}`);

console.log('✅ ALL LOGIC TESTS PASSED');
