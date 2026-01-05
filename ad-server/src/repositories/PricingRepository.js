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
        return config;
    }

    /**
     * Update pricing configuration
     */
    async updateConfig(updates) {
        const existing = await this.getConfig();
        return await this.update('global', {
            ...existing,
            ...updates
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
