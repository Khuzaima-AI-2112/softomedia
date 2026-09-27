import { describe, expect, test } from '@jest/globals';

const { agreedCpmFor, slotQuote } = await import('../src/services/CampaignPricingService.js');

const CONFIG = {
    baseCPM: 10,
    storeTrafficTiers: {
        low: { multiplier: 0.8, label: 'Low traffic' },
        medium: { multiplier: 1.0, label: 'Standard traffic' },
        high: { multiplier: 1.5, label: 'High traffic' },
    },
    retailerOverrides: {},
    trafficTiers: {
        low: { multiplier: 0.7, hours: [8, 9] },
        medium: { multiplier: 1.0, hours: [14] },
        high: { multiplier: 1.5, hours: [12, 13] },
    },
    dateOverrides: {},
};

const storesById = (...stores) => new Map(stores.map(store => [store.id, store]));

describe('the CPM a Campaign is booked at', () => {
    test('prices a booked Store by its assigned foot-traffic tier', () => {
        const agreed = agreedCpmFor({
            config: CONFIG,
            storesById: storesById({ id: 'store-1', cpm_traffic_tier: 'high' }),
            inventorySelection: [{ retailer_id: 'ret-1', store_id: 'store-1' }],
        });

        expect(agreed).toBe(15); // 10 x 1.5
    });

    test('prices a Store with no assigned tier at the standard rate', () => {
        const agreed = agreedCpmFor({
            config: CONFIG,
            storesById: storesById({ id: 'store-1' }),
            inventorySelection: [{ retailer_id: 'ret-1', store_id: 'store-1' }],
        });

        expect(agreed).toBe(10);
    });

    test('never prices from a Store’s descriptive traffic_level', () => {
        const agreed = agreedCpmFor({
            config: CONFIG,
            storesById: storesById({ id: 'store-1', traffic_level: 'high' }),
            inventorySelection: [{ retailer_id: 'ret-1', store_id: 'store-1' }],
        });

        expect(agreed).toBe(10);
    });

    test('averages the rate across Stores booked at different tiers', () => {
        const agreed = agreedCpmFor({
            config: CONFIG,
            storesById: storesById(
                { id: 'store-high', cpm_traffic_tier: 'high' },
                { id: 'store-low', cpm_traffic_tier: 'low' },
            ),
            inventorySelection: [
                { retailer_id: 'ret-1', store_id: 'store-high' },
                { retailer_id: 'ret-1', store_id: 'store-low' },
            ],
        });

        expect(agreed).toBe(11.5); // (15 + 8) / 2
    });

    test('honours a Retailer base CPM override alongside the Store tier', () => {
        const agreed = agreedCpmFor({
            config: { ...CONFIG, retailerOverrides: { 'ret-1': { baseCPM: 20 } } },
            storesById: storesById({ id: 'store-1', cpm_traffic_tier: 'high' }),
            inventorySelection: [{ retailer_id: 'ret-1', store_id: 'store-1' }],
        });

        expect(agreed).toBe(30); // 20 x 1.5
    });

    test('prices each Store against its own Retailer’s override', () => {
        const agreed = agreedCpmFor({
            config: { ...CONFIG, retailerOverrides: { 'ret-2': { baseCPM: 20 } } },
            storesById: storesById(
                { id: 'store-1', cpm_traffic_tier: 'medium' },
                { id: 'store-2', cpm_traffic_tier: 'medium' },
            ),
            inventorySelection: [
                { retailer_id: 'ret-1', store_id: 'store-1' },
                { retailer_id: 'ret-2', store_id: 'store-2' },
            ],
        });

        expect(agreed).toBe(15); // (10 + 20) / 2
    });

    test('falls back to the Retailer base CPM when no inventory was selected', () => {
        const agreed = agreedCpmFor({
            config: { ...CONFIG, retailerOverrides: { 'ret-1': { baseCPM: 12 } } },
            storesById: storesById(),
            inventorySelection: [],
            retailerId: 'ret-1',
        });

        expect(agreed).toBe(12);
    });

    test('falls back to the global base CPM for a network-wide Campaign', () => {
        expect(agreedCpmFor({ config: CONFIG, storesById: storesById(), inventorySelection: [] })).toBe(10);
        expect(agreedCpmFor({ config: CONFIG, storesById: storesById(), inventorySelection: null })).toBe(10);
    });

    test('prices a booked Store that can no longer be read at the standard rate', () => {
        const agreed = agreedCpmFor({
            config: CONFIG,
            storesById: storesById(),
            inventorySelection: [{ retailer_id: 'ret-1', store_id: 'store-missing' }],
        });

        expect(agreed).toBe(10);
    });

    test('rounds the agreed rate to whole cents', () => {
        const agreed = agreedCpmFor({
            config: { ...CONFIG, baseCPM: 9.99 },
            storesById: storesById(
                { id: 'store-high', cpm_traffic_tier: 'high' },
                { id: 'store-low', cpm_traffic_tier: 'low' },
            ),
            inventorySelection: [
                { retailer_id: 'ret-1', store_id: 'store-high' },
                { retailer_id: 'ret-1', store_id: 'store-low' },
            ],
        });

        // (9.99 x 1.5 + 9.99 x 0.8) / 2 = 11.4885
        expect(agreed).toBe(11.49);
    });
});

describe('the price of one Slot', () => {
    const quote = args => slotQuote({ config: CONFIG, retailerId: 'ret-1', date: '2030-01-07', ...args });

    test('is the Store tier times the hour tier on the base CPM', () => {
        expect(quote({ storeTier: 'high', hour: 12 })).toEqual({ price: 22.5, tier: 'high' }); // 10 x 1.5 x 1.5
        expect(quote({ storeTier: 'low', hour: 8 })).toEqual({ price: 5.6, tier: 'low' }); // 10 x 0.8 x 0.7
        expect(quote({ storeTier: null, hour: 14 })).toEqual({ price: 10, tier: 'medium' });
    });

    test('prices an hour with no tier as medium', () => {
        expect(quote({ storeTier: 'high', hour: 22 })).toEqual({ price: 15, tier: 'medium' });
    });

    test('uses the Retailer base CPM override', () => {
        const config = { ...CONFIG, retailerOverrides: { 'ret-1': { baseCPM: 20 } } };

        expect(slotQuote({ config, retailerId: 'ret-1', storeTier: null, date: '2030-01-07', hour: 14 }).price)
            .toBe(20);
    });

    test('honours a date override of the hour tier and the date multiplier', () => {
        const config = {
            ...CONFIG,
            dateOverrides: { '2030-01-07': { multiplier: 1.2, hourlyTiers: { 14: 'high' } } },
        };
        const at = date => slotQuote({ config, retailerId: 'ret-1', storeTier: null, date, hour: 14 });

        expect(at('2030-01-07')).toEqual({ price: 18, tier: 'high' }); // 10 x 1.5 x 1.2
        expect(at('2030-01-08')).toEqual({ price: 10, tier: 'medium' });
    });
});
