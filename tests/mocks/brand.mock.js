/**
 * Brand Wizard Mocks
 * Aligned with api/retailers, api/stores, api/screens schemas
 */

export const mockRetailers = [
    { id: 'ret_001', name: 'Retailer1', logo: '🏬' }
];

export const mockStores = [
    { id: 'store_001', name: 'Store1', retailer_id: 'ret_001', address: '123 Main St' }
];

export const mockScreens = [
    { id: 'scr_001', name: 'Screen1', store_id: 'store_001', status: 'online', resolution: '1920x1080', orientation: 'landscape' }
];

export const mockPricing = {
    baseCPM: 15.00,
    traffic_tiers: {
        veryLow: { multiplier: 0.5, label: 'Very Low', color: '#94a3b8', hours: [8, 9, 20, 21] },
        low: { multiplier: 0.75, label: 'Low', color: '#60a5fa', hours: [10, 11, 19] },
        medium: { multiplier: 1.0, label: 'Medium', color: '#fbbf24', hours: [14, 15, 16] },
        high: { multiplier: 1.5, label: 'High', color: '#22c55e', hours: [12, 13, 17, 18] }
    }
};
