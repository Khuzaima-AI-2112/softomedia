// PricingRepository - CPM pricing configuration and date overrides
// Extends BaseRepository for Firestore persistence

import { BaseRepository } from './BaseRepository.js';

// Default pricing config
const DEFAULT_PRICING = {
    schemaVersion: 1,
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
     * Helper to deeply normalize snake_case keys to camelCase
     */
    _normalizeConfig(data) {
        if (!data) return null;

        const normalized = {};

        // Root level
        normalized.id = data.id;
        normalized.schemaVersion = data.schemaVersion || data.schema_version || 1;
        normalized.baseCPM = data.baseCPM || data.base_cpm || DEFAULT_PRICING.baseCPM;
        normalized.currency = data.currency || data.currency || DEFAULT_PRICING.currency;
        normalized.slotDuration = data.slotDuration || data.slot_duration || DEFAULT_PRICING.slotDuration;
        normalized.slotsPerLoop = data.slotsPerLoop || data.slots_per_loop || DEFAULT_PRICING.slotsPerLoop;

        // Traffic Tiers - ensure nested objects are also handled if necessary, 
        // but here we mainly need the keys to be low/medium/high
        const rawTiers = data.trafficTiers || data.traffic_tiers || DEFAULT_PRICING.trafficTiers;
        normalized.trafficTiers = {};

        for (const [key, val] of Object.entries(rawTiers)) {
            // Map common snake_case keys just in case
            const mappedKey = key === 'very_low' ? 'veryLow' : key;
            normalized.trafficTiers[mappedKey] = {
                multiplier: val.multiplier ?? 1.0,
                label: val.label || mappedKey.charAt(0).toUpperCase() + mappedKey.slice(1),
                color: val.color || '#94a3b8',
                hours: val.hours || []
            };
        }

        normalized.dateOverrides = data.dateOverrides || data.date_overrides || {};
        normalized.retailerOverrides = data.retailerOverrides || data.retailer_overrides || {};

        return normalized;
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

        return this._normalizeConfig(config);
    }

    /**
     * Update pricing configuration
     * @param {object} updates - Config updates
     * @param {boolean} clearOverridesOnBaseCPMChange - If true, clear retailerOverrides when baseCPM changes
     */
    async updateConfig(updates, clearOverridesOnBaseCPMChange = true) {
        const existing = await this.getConfig();

        // 1. Map any incoming snake_case updates to camelCase
        const normalizedUpdates = { ...updates };
        if (updates.base_cpm !== undefined) { normalizedUpdates.baseCPM = updates.base_cpm; delete normalizedUpdates.base_cpm; }
        if (updates.traffic_tiers !== undefined) { normalizedUpdates.trafficTiers = updates.traffic_tiers; delete normalizedUpdates.traffic_tiers; }
        if (updates.date_overrides !== undefined) { normalizedUpdates.dateOverrides = updates.date_overrides; delete normalizedUpdates.date_overrides; }
        if (updates.retailer_overrides !== undefined) { normalizedUpdates.retailerOverrides = updates.retailer_overrides; delete normalizedUpdates.retailer_overrides; }

        // 2. LAYER 1: Cascading Invalidation
        // If baseCPM is changing and clearOverrides is enabled, clear retailerOverrides
        const baseCPMChanged = normalizedUpdates.baseCPM !== undefined &&
            Number(normalizedUpdates.baseCPM) !== Number(existing.baseCPM);

        if (baseCPMChanged && clearOverridesOnBaseCPMChange) {
            console.log(`[PricingRepository] baseCPM changed from ${existing.baseCPM} to ${normalizedUpdates.baseCPM} - clearing retailerOverrides to prevent ghost prices`);
            normalizedUpdates.retailerOverrides = {};
        }

        const finalConfig = {
            ...existing,
            ...normalizedUpdates,
            updatedAt: new Date().toISOString()
        };

        // 3. Cleanup: ensure strict camelCase normalization
        const keysToRemove = ['base_cpm', 'traffic_tiers', 'date_overrides', 'retailer_overrides', 'slot_duration', 'slots_per_loop'];
        keysToRemove.forEach(key => {
            if (finalConfig[key] !== undefined) delete finalConfig[key];
        });

        const result = await this.update('global', finalConfig);
        return this._normalizeConfig(result); // Return normalized to ensure UI gets camelCase
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
    async calculateSlotPrice(hour, dateStr = null) {
        const config = await this.getConfig();
        const { baseCPM, trafficTiers, dateOverrides } = config;

        // Determine traffic tier for the hour
        let tier = 'medium';

        // Check for specific date + hour override first
        if (dateStr && dateOverrides[dateStr]?.hourlyTiers?.[hour]) {
            tier = dateOverrides[dateStr].hourlyTiers[hour];
        } else {
            // Default to global hour-to-tier mapping
            for (const [tierName, tierConfig] of Object.entries(trafficTiers)) {
                if (tierConfig.hours.includes(hour)) {
                    tier = tierName;
                    break;
                }
            }
        }

        const multiplier = trafficTiers[tier]?.multiplier || 1.0;
        const dateMultiplier = dateStr ? dateOverrides[dateStr]?.multiplier || 1.0 : 1.0;

        return {
            price: baseCPM * multiplier * dateMultiplier,
            tier,
            multiplier: multiplier * dateMultiplier,
            trafficMultiplier: multiplier,
            dateMultiplier
        };
    }
}

export const PricingRepository = new PricingRepositoryClass();
export default PricingRepository;
