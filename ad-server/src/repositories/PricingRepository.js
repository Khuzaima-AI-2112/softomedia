// PricingRepository - CPM pricing configuration and date overrides
// Extends BaseRepository for Firestore persistence

import { BaseRepository } from './BaseRepository.js';

// Default pricing config
const DEFAULT_PRICING = {
    baseCPM: 15.00,
    currency: 'USD',
    slotDuration: 5,
    slotsPerLoop: 12,
    trafficTiers: {
        low: { multiplier: 0.7, label: 'Low', color: '#94a3b8', hours: [8, 9, 10, 11, 19, 20] },
        medium: { multiplier: 1.0, label: 'Medium', color: '#fbbf24', hours: [14, 15, 16] },
        high: { multiplier: 1.5, label: 'High', color: '#22c55e', hours: [12, 13, 17, 18] }
    }
};

class PricingRepositoryClass extends BaseRepository {
    constructor() {
        super('pricing_config');
    }

    /**
     * Get current pricing configuration
     * Returns default if none exists
     */
    async getConfig() {
        const config = await this.findById('global');
        if (!config) {
            // Initialize with defaults
            return await this.create('global', DEFAULT_PRICING);
        }

        // Normalize snake_case to camelCase for consistency
        return {
            id: config.id,
            baseCPM: config.baseCPM || config.base_cpm || DEFAULT_PRICING.baseCPM,
            currency: config.currency || DEFAULT_PRICING.currency,
            slotDuration: config.slotDuration || config.slot_duration || DEFAULT_PRICING.slotDuration,
            slotsPerLoop: config.slotsPerLoop || config.slots_per_loop || DEFAULT_PRICING.slotsPerLoop,
            trafficTiers: config.trafficTiers || config.traffic_tiers || DEFAULT_PRICING.trafficTiers,
            dateOverrides: config.dateOverrides || config.date_overrides || {},
            retailerOverrides: config.retailerOverrides || config.retailer_overrides || {}
        };
    }

    /**
     * Update pricing configuration
     */
    async updateConfig(updates) {
        const existing = await this.getConfig();

        // Map any incoming snake_case updates to camelCase
        const normalizedUpdates = { ...updates };
        if (updates.base_cpm !== undefined) { normalizedUpdates.baseCPM = updates.base_cpm; delete normalizedUpdates.base_cpm; }
        if (updates.traffic_tiers !== undefined) { normalizedUpdates.trafficTiers = updates.traffic_tiers; delete normalizedUpdates.traffic_tiers; }
        if (updates.date_overrides !== undefined) { normalizedUpdates.dateOverrides = updates.date_overrides; delete normalizedUpdates.date_overrides; }
        if (updates.retailer_overrides !== undefined) { normalizedUpdates.retailerOverrides = updates.retailer_overrides; delete normalizedUpdates.retailer_overrides; }

        return await this.update('global', {
            ...existing,
            ...normalizedUpdates
        });
    }

    /**
     * Set date-specific pricing override
     */
    async setDateOverride(date, overrides) {
        const id = `override_${date}`;
        return await this.create(id, {
            date,
            ...overrides,
            type: 'date_override'
        });
    }

    /**
     * Get date override if exists
     */
    async getDateOverride(date) {
        return await this.findById(`override_${date}`);
    }

    /**
     * Calculate slot price based on hour and screen
     */
    async calculateSlotPrice(hour, screenId = null) {
        const config = await this.getConfig();
        const { baseCPM, trafficTiers } = config;

        // Determine traffic tier for the hour
        let tier = 'medium';
        for (const [tierName, tierConfig] of Object.entries(trafficTiers)) {
            if (tierConfig.hours.includes(hour)) {
                tier = tierName;
                break;
            }
        }

        const multiplier = trafficTiers[tier]?.multiplier || 1.0;
        return {
            price: baseCPM * multiplier,
            tier,
            multiplier
        };
    }
}

export const PricingRepository = new PricingRepositoryClass();
export default PricingRepository;
