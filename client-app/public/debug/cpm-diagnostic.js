/* global pricingService */
/**
 * CPM Pricing Diagnostic Script
 * Run this in browser console to diagnose pricing calculation issues
 * 
 * Usage: Copy and paste into browser DevTools console, then run diagnoseCPMPricing()
 */

async function diagnoseCPMPricing() {
    console.log('='.repeat(60));
    console.log('CPM PRICING DIAGNOSTIC REPORT');
    console.log('Generated:', new Date().toISOString());
    console.log('='.repeat(60));

    // 1. Check if pricingService is available
    console.log('\n1. PricingService State:');
    if (typeof pricingService === 'undefined') {
        console.error('   ❌ pricingService not found in global scope');
        console.log('   Try: window.pricingService or import from module');
        return;
    }

    console.log('   Config:', pricingService.config);
    console.log('   Screens count:', pricingService.screens?.length || 0);
    console.log('   Stores count:', pricingService.stores?.length || 0);

    // 2. Check backend data
    console.log('\n2. Backend Data:');
    try {
        // eslint-disable-next-line no-restricted-syntax
        const response = await fetch('/api/pricing/config');
        if (!response.ok) {
            console.error('   ❌ API Error:', response.status, response.statusText);
        } else {
            const backendData = await response.json();
            console.log('   Base CPM:', backendData.baseCPM);
            console.log('   Retailer Overrides:', backendData.retailerOverrides);
            console.log('   Updated:', backendData.updatedAt);

            // Compare with service state
            if (backendData.baseCPM !== pricingService.config?.baseCPM) {
                console.warn('   ⚠️ MISMATCH: Backend baseCPM differs from service!');
                console.warn('      Backend:', backendData.baseCPM);
                console.warn('      Service:', pricingService.config?.baseCPM);
            }
        }
    } catch (e) {
        console.error('   ❌ Error fetching backend:', e);
    }

    // 3. Test calculation for each screen
    console.log('\n3. Per-Screen Pricing Test (Medium tier = 1.0x):');
    const screens = pricingService.screens || [];
    const today = new Date().toLocaleDateString('en-CA');
    const testHour = 14; // Medium tier hour

    let totalPrice = 0;
    const screenPrices = [];

    screens.forEach(screen => {
        const pricing = pricingService.getSlotPrice(screen.id, today, testHour);
        console.log(`   Screen ${screen.id}: $${pricing.price.toFixed(2)}`, {
            baseCPM: pricing.baseCPM,
            trafficMultiplier: pricing.multipliers?.traffic,
            dateMultiplier: pricing.multipliers?.date,
            storeMultiplier: pricing.multipliers?.storeTraffic
        });
        totalPrice += pricing.price;
        screenPrices.push(pricing.price);
    });

    // 4. Calculate and verify average
    console.log('\n4. Average Calculation:');
    const calculatedAvg = screens.length > 0 ? totalPrice / screens.length : 0;
    const expectedIfNoOverrides = pricingService.config?.baseCPM || 0;

    console.log('   Screen prices:', screenPrices);
    console.log('   Sum:', totalPrice.toFixed(2));
    console.log('   Count:', screens.length);
    console.log('   Calculated Average:', calculatedAvg.toFixed(2));
    console.log('   Expected (no overrides):', expectedIfNoOverrides.toFixed(2));

    if (Math.abs(calculatedAvg - expectedIfNoOverrides) > 0.01) {
        console.warn('   ⚠️ DISCREPANCY DETECTED!');
        console.warn('      This means some screens have different base prices.');
        console.warn('      Check retailerOverrides, storeOverrides, or screenOverrides.');
    } else {
        console.log('   ✅ Average matches expected base CPM');
    }

    // 5. Check for overrides
    console.log('\n5. Override Analysis:');
    const config = pricingService.config || {};

    if (config.retailerOverrides && Object.keys(config.retailerOverrides).length > 0) {
        console.log('   Retailer Overrides:');
        Object.entries(config.retailerOverrides).forEach(([id, override]) => {
            const value = override?.baseCPM || override;
            const discount = ((config.baseCPM - value) / config.baseCPM * 100).toFixed(1);
            console.log(`     ${id}: $${value} (${discount}% ${discount > 0 ? 'discount' : 'premium'})`);
        });
    } else {
        console.log('   No retailer overrides found');
    }

    if (config.storeOverrides && Object.keys(config.storeOverrides).length > 0) {
        console.log('   Store Overrides:', config.storeOverrides);
    }

    if (config.screenOverrides && Object.keys(config.screenOverrides).length > 0) {
        console.log('   Screen Overrides:', config.screenOverrides);
    }

    // 6. Daily summary test
    console.log('\n6. Daily Summary for', today);
    try {
        const summary = pricingService.getDailyPricingSummary(today);
        console.log('   Total Screens:', summary.totalScreens);
        console.log('   Sample hours:');
        [8, 12, 14, 18].forEach(h => {
            const hourData = summary.hourlyBreakdown.find(hb => hb.hour === h);
            if (hourData) {
                console.log(`     ${h}:00 - ${hourData.trafficTier?.label || 'Unknown'}: $${hourData.averageSlotPrice?.toFixed(2)}`);
            }
        });
    } catch (e) {
        console.error('   ❌ Error getting daily summary:', e);
    }

    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSIS COMPLETE');
    console.log('='.repeat(60));

    return {
        config: pricingService.config,
        screens: pricingService.screens,
        stores: pricingService.stores,
        calculatedAverage: calculatedAvg,
        expectedAverage: expectedIfNoOverrides
    };
}

// Make available globally
window.diagnoseCPMPricing = diagnoseCPMPricing;

console.log('CPM Diagnostic loaded. Run: diagnoseCPMPricing()');
