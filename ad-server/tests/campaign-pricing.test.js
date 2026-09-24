import { describe, expect, test } from '@jest/globals';

const { agreedCpmFor } = await import('../src/services/CampaignPricingService.js');

const CONFIG = {
    baseCPM: 10,
    storeTrafficTiers: {
        low: { multiplier: 0.8, label: 'Low traffic' },
        medium: { multiplier: 1.0, label: 'Standard traffic' },
        high: { multiplier: 1.5, label: 'High traffic' },
    },
    retailerOverrides: {},
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
