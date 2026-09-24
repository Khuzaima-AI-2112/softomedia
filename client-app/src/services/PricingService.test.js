import { beforeEach, describe, expect, it } from 'vitest';

import pricingService from './PricingService';

const CONFIG = {
    baseCPM: 10,
    trafficTiers: {
        medium: { multiplier: 1.0, label: 'Medium', hours: [12] },
        high: { multiplier: 1.5, label: 'High', hours: [17] },
    },
    storeTrafficTiers: {
        low: { multiplier: 0.8, label: 'Low traffic' },
        medium: { multiplier: 1.0, label: 'Standard traffic' },
        high: { multiplier: 1.5, label: 'High traffic' },
    },
    dateOverrides: {},
    retailerOverrides: {},
};

const screenAt = (storeId) => ({ id: `screen-${storeId}`, store_id: storeId, retailer_id: 'ret-1' });

describe('PricingService — per-Store foot-traffic tiers', () => {
    beforeEach(() => {
        pricingService.config = { ...CONFIG };
        pricingService.screens = [
            screenAt('store-high'),
            screenAt('store-low'),
            screenAt('store-untiered'),
        ];
        pricingService.stores = [
            { id: 'store-high', cpm_traffic_tier: 'high' },
            { id: 'store-low', cpm_traffic_tier: 'low' },
            { id: 'store-untiered' },
        ];
    });

    // The Store's descriptive traffic_level has never moved a price and must
    // not start now, or existing Stores would reprice with no admin action.
    it('does not price from a Store’s descriptive traffic_level', () => {
        pricingService.stores = [{ id: 'store-high', traffic_level: 'high' }];
        const pricing = pricingService.getSlotPrice('screen-store-high', '2030-01-16', 12);
        expect(pricing.price).toBe(10);
        expect(pricing.multipliers.storeTraffic).toBe(1.0);
    });

    it('applies the Store tier multiplier on top of the hour-of-day tier', () => {
        // base 10 x hour tier 1.0 x store tier 1.5
        expect(pricingService.getSlotPrice('screen-store-high', '2030-01-16', 12).price).toBe(15);
        // base 10 x hour tier 1.0 x store tier 0.8
        expect(pricingService.getSlotPrice('screen-store-low', '2030-01-16', 12).price).toBe(8);
    });

    it('compounds the Store tier with a higher hour-of-day tier', () => {
        // base 10 x hour tier 1.5 x store tier 1.5
        expect(pricingService.getSlotPrice('screen-store-high', '2030-01-16', 17).price).toBe(22.5);
    });

    it('prices a Store with no assigned tier at the standard 1.0x', () => {
        const pricing = pricingService.getSlotPrice('screen-store-untiered', '2030-01-16', 12);
        expect(pricing.price).toBe(10);
        expect(pricing.multipliers.storeTraffic).toBe(1.0);
    });

    it('reports the Store tier multiplier so no price-altering factor stays hidden', () => {
        const pricing = pricingService.getSlotPrice('screen-store-high', '2030-01-16', 12);
        expect(pricing.multipliers.storeTraffic).toBe(1.5);
        expect(pricing.storeTrafficTier).toEqual({ key: 'high', multiplier: 1.5, label: 'High traffic' });
    });

    it('names an unassigned Store’s tier as unassigned rather than as a real tier', () => {
        const pricing = pricingService.getSlotPrice('screen-store-untiered', '2030-01-16', 12);
        expect(pricing.storeTrafficTier.key).toBeNull();
        expect(pricing.storeTrafficTier.label).toMatch(/No tier assigned/);
    });

    it('falls back to 1.0x when the Store names a tier that is not configured', () => {
        pricingService.stores = [{ id: 'store-high', cpm_traffic_tier: 'nonexistent' }];
        expect(pricingService.getSlotPrice('screen-store-high', '2030-01-16', 12).price).toBe(10);
    });

    it('uses the per-Store multiplier the Bookable Inventory supplies to a Brand', () => {
        pricingService.configureBookableInventory([{
            retailer: { id: 'ret-1', name: 'Retailer' },
            store: { id: 'store-high', name: 'Store', cpm_traffic_tier: 'high' },
            location: { id: 'loc-1', name: 'Entrance' },
            screen: { id: 'screen-store-high' },
            booking_price: {
                base: 10,
                store_traffic_multiplier: 1.5,
                traffic_tiers: [{ id: 'medium', label: 'Medium', multiplier: 1.0, hours: [12] }],
                date_overrides: {},
            },
        }]);

        const pricing = pricingService.getSlotPrice('screen-store-high', '2030-01-16', 12);
        expect(pricing.price).toBe(15);
        // A 1.5x factor must never be shown as the standard tier.
        expect(pricing.storeTrafficTier.label).toBe('High traffic');
    });

    it('carries the Store tier into a campaign total', () => {
        const total = pricingService.calculateCampaignTotal([
            { screenId: 'screen-store-high', date: '2030-01-16', hour: 12, slotCount: 2 },
        ]);
        expect(total.totalCost).toBe(30); // 15 per slot x 2
    });
});
