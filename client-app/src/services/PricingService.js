import apiService from './ApiService';
import { UNASSIGNED_STORE_TIER, storeTierLabel } from '../constants/storeTrafficTiers';

class PricingService {
    constructor() {
        this.config = null;
        this.screens = [];
        this.stores = [];
    }

    configureBookableInventory(items = []) {
        const firstPrice = items[0]?.booking_price;
        const trafficTiers = Object.fromEntries((firstPrice?.traffic_tiers || []).map(tier => [
            tier.id,
            { label: tier.label, multiplier: tier.multiplier, hours: tier.hours },
        ]));
        this.config = {
            baseCPM: firstPrice?.base || 2.50,
            trafficTiers,
            dateOverrides: Object.fromEntries(Object.entries(firstPrice?.date_overrides || {})
                .map(([date, override]) => [date, {
                    multiplier: override.multiplier,
                    hourlyTiers: override.hourly_tiers,
                }])),
            screenOverrides: Object.fromEntries(items.map(item => [
                item.screen.id,
                { baseCPM: item.booking_price.base },
            ])),
            // Bookable Inventory carries each Store's own tier multiplier; a
            // Brand is not shown the Super Administrator's tier catalogue.
            storeTrafficMultipliers: Object.fromEntries(items.map(item => [
                item.store.id,
                item.booking_price.store_traffic_multiplier ?? 1.0,
            ])),
        };
        this.screens = items.map(item => ({
            ...item.screen,
            store_id: item.store.id,
            retailer_id: item.retailer.id,
        }));
        this.stores = [...new Map(items.map(item => [item.store.id, item.store])).values()];
    }

    /**
     * Initialize PricingService with data from backend
     * @param {boolean} forceRefresh - If true, re-fetches all data even if already initialized
     */
    async init(forceRefresh = false) {
        if (this.config && !forceRefresh) return;
        try {

            const [configData, screensData, storesData] = await Promise.all([
                apiService.getPricingConfig(),
                apiService.getScreens(),
                apiService.getStores()
            ]);
            this.config = configData;
            this.screens = screensData;
            this.stores = storesData;



            // Validate configuration after loading
            this.validateConfiguration();
        } catch (error) {
            console.error('Failed to initialize PricingService:', error);
            // Fallback to defaults
            this.config = {
                baseCPM: 2.50,
                trafficTiers: {
                    veryLow: { multiplier: 0.5, label: 'Very Low', color: '#94a3b8', hours: [8, 9, 20, 21] },
                    low: { multiplier: 0.75, label: 'Low', color: '#60a5fa', hours: [10, 11, 19] },
                    medium: { multiplier: 1.0, label: 'Medium', color: '#fbbf24', hours: [14, 15, 16] },
                    high: { multiplier: 1.5, label: 'High', color: '#22c55e', hours: [12, 13, 17, 18] }
                }
            };
        }
    }

    /**
     * Get the traffic tier for a specific hour
     * @param {number} hour - Hour of the day (0-23)
     * @param {string} date - Optional date for granular overrides
     * @returns {object} Traffic tier info { key, multiplier, label, color }
     */
    getTrafficTier(hour, date = null) {
        const defaultTier = { key: 'medium', multiplier: 1.0, label: 'Medium', color: '#fbbf24' };
        const tiers = this.config?.trafficTiers || this.config?.traffic_tiers;
        if (!tiers) return defaultTier;

        // 1. Check for specific date + hour override
        if (date && this.config?.dateOverrides?.[date]?.hourlyTiers?.[hour]) {
            const tierKey = this.config.dateOverrides[date].hourlyTiers[hour];
            if (tiers[tierKey]) return { key: tierKey, ...tiers[tierKey] };
        }

        // 2. Default to global hour-to-tier mapping
        for (const [key, tier] of Object.entries(tiers)) {
            if (tier.hours && Array.isArray(tier.hours) && tier.hours.includes(hour)) {
                return { key, ...tier };
            }
        }

        // Default to medium if not found
        return tiers.medium ? { key: 'medium', ...tiers.medium } : defaultTier;
    }

    /**
     * Get a Store's own foot-traffic tier, which prices its Slots in addition
     * to the hour-of-day tier. A Store with no tier, or one naming a tier that
     * is not configured, prices as Standard (1.0x).
     *
     * This multiplier is deliberately surfaced in every price it affects and is
     * editable in the Super Administrator's Pricing Configuration — INC-2026-01-12
     * traced a pricing discrepancy to an earlier version of it being applied
     * while invisible.
     * Read from the Store's explicitly assigned `cpm_traffic_tier`, never its
     * descriptive `traffic_level`.
     * @param {string} storeId
     * @returns {object} { key, multiplier, label }
     */
    getStoreTrafficTier(storeId) {
        if (!storeId) return UNASSIGNED_STORE_TIER;

        const store = this.stores?.find(candidate => candidate.id === storeId);
        const key = store?.cpm_traffic_tier || null;
        const suppliedMultiplier = this.config?.storeTrafficMultipliers?.[storeId];

        if (suppliedMultiplier !== undefined) {
            if (!key) return UNASSIGNED_STORE_TIER;
            return {
                key,
                multiplier: suppliedMultiplier,
                label: this.config?.storeTrafficTiers?.[key]?.label || storeTierLabel(key),
            };
        }
        if (!key) return UNASSIGNED_STORE_TIER;

        const tier = this.config?.storeTrafficTiers?.[key];
        return tier
            ? { key, multiplier: tier.multiplier, label: tier.label }
            : UNASSIGNED_STORE_TIER;
    }

    /**
     * Get base CPM for a specific screen, store, or retailer
     * Checks for overrides in order: screen > store > retailer > global
     * @param {string} screenId 
     * @param {string} storeId 
     * @param {string} retailerId 
     * @returns {number} Base CPM in dollars
     */
    getBaseCPM(screenId, storeId, retailerId) {
        if (!this.config) return 2.50;
        const config = this.config;

        // Check screen-level override
        if (screenId && config.screenOverrides?.[screenId]?.baseCPM) {
            return config.screenOverrides[screenId].baseCPM;
        }

        // Check store-level override
        if (storeId && config.storeOverrides?.[storeId]?.baseCPM) {
            return config.storeOverrides[storeId].baseCPM;
        }

        // Check retailer-level override
        if (retailerId && config.retailerOverrides?.[retailerId]?.baseCPM) {
            return config.retailerOverrides[retailerId].baseCPM;
        }

        // Return global base CPM
        return config.baseCPM || config.base_cpm || 2.50;
    }

    /**
     * Calculate slot price based on base CPM and active multipliers
     */
    calculateSlotPrice(hour, date, retailerId = null) {
        if (!this.config) return null;

        // 1. Determine Base CPM (Check for Retailer Override first)
        let baseCPM = this.config.baseCPM;
        if (retailerId && this.config.retailerOverrides?.[retailerId]?.baseCPM) {
            baseCPM = this.config.retailerOverrides[retailerId].baseCPM;

        }

        // 2. Get Traffic Tier Multiplier
        let tierMultiplier = 1.0;
        const tier = this.getTrafficTier(hour, date); // Use getTrafficTier to get the full tier object
        if (tier) {
            tierMultiplier = tier.multiplier;
        }

        // 3. Get Date Override Multiplier
        let dateMultiplier = 1.0;
        const dateKey = this._formatDateKey(date); // Assuming _formatDateKey exists or will be added
        const dateOverride = this.config.dateOverrides?.[dateKey];
        if (dateOverride) {
            dateMultiplier = dateOverride.multiplier;
        }

        // 4. Calculate Final Price
        // Store-level foot traffic is not known here; getSlotPrice applies it
        // per Screen, where the Store is known.
        const finalPrice = baseCPM * tierMultiplier * dateMultiplier;

        return finalPrice;
    }

    /**
     * Helper to format date string for consistent key access
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {string} Formatted date key
     */
    _formatDateKey(date) {
        // Ensure date is in YYYY-MM-DD format
        if (date instanceof Date) {
            return date.toISOString().split('T')[0];
        }
        return date; // Assume it's already in the correct string format
    }

    /**
     * Get date-specific multiplier for special events/holidays
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {number} Multiplier (1.0 = no change)
     */
    getDateMultiplier(date) {
        if (!this.config) return 1.0;
        return this.config.dateOverrides?.[date]?.multiplier || 1.0;
    }

    /**
     * Calculate the price for a single slot
     * RULE: Only applies multipliers that are VISIBLE in Super Admin UI
     * - Base CPM (visible in header)
     * - Traffic Tier multiplier (visible in dropdown)
     * - Date Override multiplier (visible in date override section)
     * - Store foot-traffic tier (visible and editable in Pricing Configuration)
     *
     * @param {string} screenId
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @param {number} hour - Hour of the day (0-23)
     * @returns {object} { price, baseCPM, trafficTier, storeTrafficTier, multipliers }
     */
    getSlotPrice(screenId, date, hour) {
        const screen = this.screens.find(s => s.id === screenId);
        if (!screen) {
            return { price: 0, error: 'Screen not found' };
        }

        const baseCPM = this.getBaseCPM(screenId, screen.store_id, screen.retailer_id);
        const trafficTier = this.getTrafficTier(hour, date);
        const dateMultiplier = this.getDateMultiplier(date);
        const storeTrafficTier = this.getStoreTrafficTier(screen.store_id);

        // Formula: Base CPM × Traffic Tier × Date Multiplier × Store Traffic Tier
        const price = baseCPM * trafficTier.multiplier * dateMultiplier * storeTrafficTier.multiplier;

        return {
            price: Math.round(price * 100) / 100, // Round to 2 decimal places
            baseCPM,
            trafficTier,
            storeTrafficTier,
            multipliers: {
                traffic: trafficTier.multiplier,
                date: dateMultiplier,
                storeTraffic: storeTrafficTier.multiplier
            }
        };
    }

    /**
     * Calculate the price for a full loop (12 slots)
     * @param {string} screenId 
     * @param {string} date 
     * @param {number} hour 
     * @returns {object} { totalPrice, perSlotPrice, slots: 12, ... }
     */
    getLoopPrice(screenId, date, hour) {
        const slotPricing = this.getSlotPrice(screenId, date, hour);

        return {
            ...slotPricing,
            totalPrice: Math.round(slotPricing.price * 12 * 100) / 100,
            perSlotPrice: slotPricing.price,
            slots: 12
        };
    }

    /**
     * Get estimated impressions for a slot based on traffic tier
     * @param {string} screenId 
     * @param {number} hour 
     * @returns {number} Estimated impressions per slot
     */
    getEstimatedImpressions(screenId, hour) {
        const screen = this.screens.find(s => s.id === screenId);
        const store = screen ? this.stores.find(s => s.id === screen.store_id) : null;
        const trafficTier = this.getTrafficTier(hour);

        // Base impressions per slot (5 seconds)
        let baseImpressions = 50; // Assume 50 people see a 5-second ad on average

        // Adjust by traffic tier
        switch (trafficTier.key) {
            case 'veryLow': baseImpressions *= 0.3; break;
            case 'low': baseImpressions *= 0.6; break;
            case 'medium': baseImpressions *= 1.0; break;
            case 'high': baseImpressions *= 1.8; break;
        }

        // Adjust by the Store's descriptive foot traffic. These factors estimate
        // audience, not price: they are deliberately independent of the
        // storeTrafficTiers multipliers, which bill against the separately
        // assigned `cpm_traffic_tier`. Do not reconcile the two — describing a
        // Store as busy must never move what it charges.
        if (store?.traffic_level === 'high') baseImpressions *= 1.5;
        else if (store?.traffic_level === 'low') baseImpressions *= 0.7;

        // Adjust by screen type
        if (screen?.type === 'checkout') baseImpressions *= 1.3; // More eyeballs at checkout
        else if (screen?.type === 'entrance') baseImpressions *= 1.2;

        return Math.round(baseImpressions);
    }

    /**
     * Calculate total campaign cost for a set of slot selections
     * @param {Array} selections - Array of { screenId, date, hour, slotCount }
     * @returns {object} { totalCost, totalSlots, totalImpressions, breakdown }
     */
    calculateCampaignTotal(selections) {
        let totalCost = 0;
        let totalSlots = 0;
        let totalImpressions = 0;
        const breakdown = [];

        for (const selection of selections) {
            const { screenId, date, hour, slotCount } = selection;
            const slotPricing = this.getSlotPrice(screenId, date, hour);
            const impressionsPerSlot = this.getEstimatedImpressions(screenId, hour);

            const selectionCost = slotPricing.price * slotCount;
            const selectionImpressions = impressionsPerSlot * slotCount;

            totalCost += selectionCost;
            totalSlots += slotCount;
            totalImpressions += selectionImpressions;

            breakdown.push({
                screenId,
                date,
                hour,
                slotCount,
                pricePerSlot: slotPricing.price,
                totalPrice: Math.round(selectionCost * 100) / 100,
                impressions: selectionImpressions,
                trafficTier: slotPricing.trafficTier
            });
        }

        return {
            totalCost: Math.round(totalCost * 100) / 100,
            totalSlots,
            totalImpressions,
            breakdown,
            averageCPM: totalSlots > 0 ? Math.round((totalCost / totalSlots) * 100) / 100 : 0
        };
    }

    /**
     * Get pricing summary for a date across all screens
     * @param {string} date 
     * @returns {object} Summary with hourly breakdown
     */
    getDailyPricingSummary(date, businessHoursRange = null) {
        const screens = this.screens;
        const hours = [];

        // Use provided range or default to 8-22
        const businessHours = businessHoursRange || { START: 8, END: 22 };

        for (let hour = businessHours.START; hour < businessHours.END; hour++) {
            const trafficTier = this.getTrafficTier(hour, date);
            const dateMultiplier = this.getDateMultiplier(date);

            // Calculate average price across all screens
            let totalPrice = 0;
            let totalImpressions = 0;

            screens.forEach(screen => {
                const pricing = this.getSlotPrice(screen.id, date, hour);
                totalPrice += pricing.price;
                totalImpressions += this.getEstimatedImpressions(screen.id, hour);
            });

            hours.push({
                hour,
                trafficTier,
                dateMultiplier,
                averageSlotPrice: screens.length > 0
                    ? Math.round((totalPrice / screens.length) * 100) / 100
                    : 0,
                totalEstimatedImpressions: totalImpressions
            });
        }

        return {
            date,
            businessHours,
            hourlyBreakdown: hours,
            totalScreens: screens.length
        };
    }

    /**
     * Get slot availability summary (Sync version using provided loop data)
     * @param {object} loop 
     * @returns {object} { available, booked, total, slots }
     */
    getSlotAvailabilityFromLoop(loop) {
        if (!loop) {
            return {
                available: 12,
                booked: 0,
                total: 12,
                slots: Array(12).fill({ status: 'available' })
            };
        }

        return {
            available: loop.slots.filter(s => s.status === 'available').length,
            booked: loop.slots.filter(s => s.status !== 'available').length,
            total: 12,
            slots: loop.slots
        };
    }

    /**
     * Format price for display
     * @param {number} price 
     * @param {string} currency 
     * @returns {string} Formatted price string
     */
    formatPrice(price, currency = 'USD') {
        if (price === undefined || price === null || isNaN(price)) {
            return '$0.00';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    /**
     * Format impressions for display
     * @param {number} impressions 
     * @returns {string} Formatted impressions string (e.g., "1.2K", "3.5M")
     */
    formatImpressions(impressions) {
        if (impressions === undefined || impressions === null || isNaN(impressions)) {
            return '0';
        }
        if (impressions >= 1000000) {
            return `${(impressions / 1000000).toFixed(1)}M`;
        } else if (impressions >= 1000) {
            return `${(impressions / 1000).toFixed(1)}K`;
        }
        return impressions.toString();
    }

    /**
     * CRITICAL: Handle global CPM updates with override refresh
     * @param {object} newConfig 
     */
    async updateConfig(newConfig) {
        if (!newConfig) return;



        // If baseCPM changed, must refresh from database to get updated overrides
        if (newConfig.baseCPM !== undefined &&
            newConfig.baseCPM !== this.config?.baseCPM) {



            // Force complete re-initialization to fetch fresh data from DB
            await this.init(true);
            return;
        }

        // For non-CPM updates, safe merge
        this.config = {
            ...this.config,
            ...newConfig
        };

        // Explicitly update trafficTiers
        if (newConfig.trafficTiers !== undefined) {
            this.config.trafficTiers = newConfig.trafficTiers;
        } else if (newConfig.traffic_tiers !== undefined) {
            this.config.trafficTiers = newConfig.traffic_tiers;
        }

        // Explicitly update dateOverrides
        if (newConfig.dateOverrides !== undefined) {
            this.config.dateOverrides = newConfig.dateOverrides;
        } else if (newConfig.date_overrides !== undefined) {
            this.config.dateOverrides = newConfig.date_overrides;
        }

        // Explicitly update storeTrafficTiers
        if (newConfig.storeTrafficTiers !== undefined) {
            this.config.storeTrafficTiers = newConfig.storeTrafficTiers;
        } else if (newConfig.store_traffic_tiers !== undefined) {
            this.config.storeTrafficTiers = newConfig.store_traffic_tiers;
        }

        // Explicitly update retailerOverrides
        if (newConfig.retailerOverrides !== undefined) {
            this.config.retailerOverrides = newConfig.retailerOverrides;
        } else if (newConfig.retailer_overrides !== undefined) {
            this.config.retailerOverrides = newConfig.retailer_overrides;
        }



        // Validate after update
        this.validateConfiguration();
    }

    /**
     * CRITICAL: Verify configuration integrity
     * @returns {boolean} True if configuration is valid
     */
    validateConfiguration() {
        if (!this.config) {
            console.error('[PricingService] No configuration loaded');
            return false;
        }

        const { baseCPM, retailerOverrides } = this.config;
        const issues = [];

        // Check base CPM is reasonable
        if (!baseCPM || baseCPM < 0.01 || baseCPM > 1000) {
            issues.push(`Invalid baseCPM: ${baseCPM}`);
        }

        // Check for unusual retailer overrides
        if (retailerOverrides) {
            Object.entries(retailerOverrides).forEach(([retailerId, override]) => {
                const overrideValue = override?.baseCPM || override;
                if (overrideValue && baseCPM) {
                    const discount = ((baseCPM - overrideValue) / baseCPM) * 100;
                    if (discount > 50) {
                        console.warn(
                            `[PRICING_ALERT] Retailer ${retailerId} has extreme discount: ${discount.toFixed(1)}% (override: $${overrideValue}, base: $${baseCPM})`
                        );
                    }
                }
            });
        }

        if (issues.length > 0) {
            console.error('[PRICING_VALIDATION] Issues detected:', issues);
            return false;
        }


        return true;
    }
}

// Singleton instance
const pricingService = new PricingService();

// Expose globally for debugging (remove in production)
if (typeof window !== 'undefined') {
    window.pricingService = pricingService;
}

export default pricingService;
